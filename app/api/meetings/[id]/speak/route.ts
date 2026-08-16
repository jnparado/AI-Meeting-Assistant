import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import { enqueueBotSpeech } from "@/lib/voice-agent/speech-queue";
import type { BotStatus } from "@/lib/types/database";

const LIVE_STATUSES = new Set<BotStatus>([
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: meetingId } = await context.params;
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

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
    .select("id, status")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!bot?.id) {
    return NextResponse.json(
      { error: "No AI assistant scheduled for this meeting." },
      { status: 400 },
    );
  }

  const status = String(bot.status ?? "") as BotStatus;
  if (!LIVE_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "Wait until the AI assistant has joined the meeting." },
      { status: 400 },
    );
  }

  try {
    const { id } = await enqueueBotSpeech(supabase, bot.id, text);
    return NextResponse.json({ ok: true, id, text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not queue speech";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
