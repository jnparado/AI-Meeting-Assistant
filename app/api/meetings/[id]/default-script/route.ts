import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import { getRecallVoiceAgentDefaultScript } from "@/lib/bot/recall-voice-agent";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: meetingId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const meeting = await loadMeetingForUserSecure(
    meetingId,
    user.id,
    organization.id,
  );

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({
    script: getRecallVoiceAgentDefaultScript(),
  });
}
