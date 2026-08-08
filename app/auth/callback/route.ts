import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { ensureUserWorkspace } from "@/lib/org/ensure-workspace";
import { ORG_COOKIE } from "@/lib/org/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const meta = user.user_metadata as {
          full_name?: string;
          organization_name?: string;
        };
        const workspace = await ensureUserWorkspace(user.id, user.email, {
          full_name: meta.full_name,
          organization_name: meta.organization_name,
        });

        const orgId = workspace?.organizationId;
        if (orgId) {
          const cookieStore = await cookies();
          cookieStore.set(ORG_COOKIE, orgId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth&next=${encodeURIComponent(next)}`,
  );
}
