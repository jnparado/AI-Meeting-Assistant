import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/lib/org/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organization = await requireActiveOrganization(user.id);
  const body = await request.json();

  const { error } = await supabase.from("organization_integrations").upsert({
    organization_id: organization.id,
    follow_up_email: Boolean(body.follow_up_email),
    follow_up_slack: Boolean(body.follow_up_slack),
    follow_up_crm: Boolean(body.follow_up_crm),
    slack_webhook_url: body.slack_webhook_url ?? null,
    crm_provider: body.crm_provider ?? null,
    crm_access_token: body.crm_access_token ?? null,
    notification_email: body.notification_email ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
