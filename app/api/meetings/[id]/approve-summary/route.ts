import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import {
  approveAndSendEmailSummary,
  dismissEmailSummaryApproval,
} from "@/lib/follow-up/dispatch";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: meetingId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  let action = "approve";
  try {
    const body = (await request.json()) as { action?: string };
    action = body.action === "dismiss" ? "dismiss" : "approve";
  } catch {
    action = "approve";
  }

  try {
    if (action === "dismiss") {
      await dismissEmailSummaryApproval(meetingId, user.id);
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    await approveAndSendEmailSummary(meetingId, user.id);
    return NextResponse.json({ ok: true, status: "sent" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send email";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
