import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/org/ensure-workspace";
import { ORG_COOKIE } from "@/lib/org/server";
import { cookies } from "next/headers";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const meta = user.user_metadata as {
    full_name?: string;
    organization_name?: string;
  };

  const workspace = await ensureUserWorkspace(user.id, user.email, {
    full_name: meta.full_name,
    organization_name: meta.organization_name,
  });

  if (workspace?.organizationId) {
    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE, workspace.organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: meta.full_name ?? null,
    },
    organizationId: workspace?.organizationId ?? null,
  });
}
