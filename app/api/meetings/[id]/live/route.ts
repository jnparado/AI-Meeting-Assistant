import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";
import { filterBotTranscriptSegments, isBotSpeaker } from "@/lib/transcripts/filter-bot-speech";
import {
  buildConversationFeed,
  mergeTranscriptSegments,
} from "@/lib/transcripts/conversation-feed";
import { refreshMeetingBotFromRecall } from "@/lib/bot/refresh-recall-bot-status";
import { resolveActiveMeetingBot } from "@/lib/bot/resolve-active-meeting-bot";
import {
  isBotControllable,
  isBotLive,
} from "@/lib/bot/bot-control-status";

const statusRefreshCache = new Map<
  string,
  { status: BotStatus; refreshedAt: number }
>();
const STATUS_REFRESH_MS = 4000;

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

  const resolved = await resolveActiveMeetingBot({
    supabase,
    meetingId,
    organizationId: organization.id,
    userId: user.id,
    meetingUrl: (meeting.meeting_url as string | null) ?? null,
  });

  const bot = resolved
    ? {
        id: resolved.id,
        status: resolved.status,
        metadata: resolved.metadata,
        bot_name: resolved.bot_name,
        external_bot_id: resolved.external_bot_id,
      }
    : null;

  let botStatus = (bot?.status as BotStatus | undefined) ?? null;
  if (bot?.external_bot_id) {
    const botId = String(bot.id);
    const cached = statusRefreshCache.get(botId);
    const now = Date.now();
    if (!cached || now - cached.refreshedAt > STATUS_REFRESH_MS) {
      const refreshed = await refreshMeetingBotFromRecall({
        id: botId,
        external_bot_id: bot.external_bot_id as string,
        status: String(bot.status ?? "scheduled"),
      });
      if (refreshed) {
        botStatus = refreshed;
        statusRefreshCache.set(botId, { status: refreshed, refreshedAt: now });
      }
    } else {
      botStatus = cached.status;
    }
  }

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("full_text, segments, updated_at")
    .eq("meeting_id", meetingId)
    .maybeSingle();

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
  const segments = mergeTranscriptSegments(filteredSegments, metadataSegments);
  const partialSpeaker = livePartial?.speaker ?? "Speaker";
  const partialText = livePartial?.text;
  const showPartial =
    partialText &&
    !isBotSpeaker(partialSpeaker, botName);
  const livePartialPayload = showPartial
    ? { speaker: partialSpeaker, text: partialText }
    : null;

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
    .slice(-12)
    .map((item) => ({
      text: String((item as { text: string }).text),
      delivered: Boolean((item as { deliveredAt?: string | null }).deliveredAt),
    }));

  const conversation = buildConversationFeed({
    segments,
    livePartial: livePartialPayload,
    sentScripts,
    botName,
  });

  const canControl = isBotControllable(botStatus);
  const canSpeak = Boolean(bot?.id) && canControl;

  return NextResponse.json({
    isLive: isBotLive(botStatus),
    hasBot: Boolean(bot?.id),
    hasActiveBot: canControl,
    canStop: canControl || Boolean(bot?.id),
    canSpeak,
    botStatus,
    botName,
    segments,
    conversation,
    fullText: transcript?.full_text ?? "",
    updatedAt: transcript?.updated_at ?? null,
    livePartial: livePartialPayload,
    pendingSpeechCount: pendingSpeech.length,
    sentScripts,
  });
}
