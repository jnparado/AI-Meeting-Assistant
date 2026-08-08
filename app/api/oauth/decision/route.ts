import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const decision = String(formData.get("decision") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "").trim();

  if (!authorizationId) {
    return NextResponse.json({ error: "Missing authorization_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (decision === "approve") {
    const { data, error } =
      await supabase.auth.oauth.approveAuthorization(authorizationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const redirectUrl = data?.redirect_url;
    if (!redirectUrl) {
      return NextResponse.json({ error: "Missing redirect_url" }, { status: 400 });
    }

    return NextResponse.redirect(redirectUrl);
  }

  if (decision === "deny") {
    const { data, error } =
      await supabase.auth.oauth.denyAuthorization(authorizationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const redirectUrl = data?.redirect_url;
    if (!redirectUrl) {
      return NextResponse.json({ error: "Missing redirect_url" }, { status: 400 });
    }

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
}
