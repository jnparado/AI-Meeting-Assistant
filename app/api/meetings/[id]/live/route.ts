import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";

const LIVE_STATUSES = new Set<BotStatus>([
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

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

  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("status, metadata")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("full_text, segments, updated_at")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  const status = (bot?.status as BotStatus | undefined) ?? null;
  const metadata = (bot?.metadata as Record<string, unknown> | null) ?? {};
  const livePartial = metadata.live_partial as
    | { speaker?: string; text?: string }
    | undefined;

  return NextResponse.json({
    isLive: status ? LIVE_STATUSES.has(status) : false,
    botStatus: status,
    segments: (transcript?.segments as TranscriptSegment[] | null) ?? [],
    fullText: transcript?.full_text ?? "",
    updatedAt: transcript?.updated_at ?? null,
    livePartial: livePartial?.text
      ? {
          speaker: livePartial.speaker ?? "Speaker",
          text: livePartial.text,
        }
      : null,
  });
}
