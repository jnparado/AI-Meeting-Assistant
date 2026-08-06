import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/org/server";
import { ensureUserWorkspace } from "@/lib/org/ensure-workspace";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meta = user.user_metadata as {
    full_name?: string;
    organization_name?: string;
  };

  const workspace = await ensureUserWorkspace(user.id, user.email, {
    full_name: meta.full_name,
    organization_name: meta.organization_name,
  });

  if (!workspace?.organizationId) {
    return NextResponse.json(
      { error: "Could not initialize workspace" },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, workspace.organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, organizationId: workspace.organizationId });
}
