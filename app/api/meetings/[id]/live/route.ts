import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";
import { filterBotTranscriptSegments, isBotSpeaker } from "@/lib/transcripts/filter-bot-speech";
import {
  isBotControllable,
  isBotLive,
} from "@/lib/bot/bot-control-status";

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
    .select("id, status, metadata, bot_name")
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

  const botName = (bot?.bot_name as string | null) ?? null;
  const rawSegments =
    (transcript?.segments as TranscriptSegment[] | null) ?? [];
  const filteredSegments = filterBotTranscriptSegments(rawSegments, botName);
  const metadataConversation =
    (metadata.live_conversation as
      | { speaker?: string; text?: string }[]
      | undefined) ?? [];
  const metadataSegments = metadataConversation
    .map((entry) => ({
      speaker: entry.speaker?.trim() || "Speaker",
      text: entry.text?.trim() ?? "",
    }))
    .filter((entry) => entry.text && !isBotSpeaker(entry.speaker, botName));
  const segments =
    filteredSegments.length > 0 ? filteredSegments : metadataSegments;
  const partialSpeaker = livePartial?.speaker ?? "Speaker";
  const partialText = livePartial?.text;
  const showPartial =
    partialText &&
    !isBotSpeaker(partialSpeaker, botName);

  const speechQueue = Array.isArray(metadata.speech_queue)
    ? metadata.speech_queue
    : [];
  const pendingSpeech = speechQueue.filter(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { text?: string }).text === "string" &&
      !(item as { deliveredAt?: string | null }).deliveredAt,
  );
  const sentScripts = speechQueue
    .filter(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { text?: string }).text === "string",
    )
    .slice(-8)
    .map((item) => ({
      text: String((item as { text: string }).text),
      delivered: Boolean((item as { deliveredAt?: string | null }).deliveredAt),
    }));

  const canControl = isBotControllable(status);

  return NextResponse.json({
    isLive: isBotLive(status),
    hasBot: Boolean(bot?.id),
    hasActiveBot: canControl,
    canStop: canControl || Boolean(bot?.id),
    canSpeak: canControl,
    botStatus: status,
    botName,
    segments,
    fullText: transcript?.full_text ?? "",
    updatedAt: transcript?.updated_at ?? null,
    livePartial: showPartial
      ? {
          speaker: partialSpeaker,
          text: partialText,
        }
      : null,
    pendingSpeechCount: pendingSpeech.length,
    sentScripts,
  });
}
