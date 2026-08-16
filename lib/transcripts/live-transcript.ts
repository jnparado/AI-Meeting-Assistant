import type { SupabaseClient } from "@supabase/supabase-js";
import type { TranscriptSegment } from "@/lib/types/database";
import { isBotSpeaker } from "@/lib/transcripts/filter-bot-speech";

type Word = { text?: string };

export type ParsedLiveTranscript = {
  externalBotId: string;
  speaker: string;
  text: string;
  isPartial: boolean;
};

export function parseRecallLiveTranscriptPayload(
  payload: Record<string, unknown>,
): ParsedLiveTranscript | null {
  const event = String(payload.event ?? "");
  const isPartial = event === "transcript.partial_data";
  if (event !== "transcript.data" && !isPartial) return null;

  const root = (payload.data ?? payload) as Record<string, unknown>;
  const inner = (root.data ?? root) as {
    words?: Word[];
    participant?: { name?: string | null };
  };
  const botObj = (root.bot ?? payload.bot) as { id?: string } | undefined;
  const externalBotId = [
    botObj?.id,
    root.bot_id,
    payload.bot_id,
    (root.recording as { bot_id?: string } | undefined)?.bot_id,
  ]
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .find(Boolean);
  if (!externalBotId) return null;

  const text = (inner.words ?? [])
    .map((w) => w.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!text) return null;

  const speaker = inner.participant?.name?.trim() || "Speaker";
  return { externalBotId, speaker, text, isPartial };
}

type LiveConversationEntry = {
  speaker: string;
  text: string;
  at: string;
};

async function resolveTranscriptUserId(
  supabase: SupabaseClient,
  meetingId: string,
  botUserId: string | null | undefined,
): Promise<string | null> {
  if (botUserId) return botUserId;

  const { data: meeting } = await supabase
    .from("meetings")
    .select("user_id")
    .eq("id", meetingId)
    .maybeSingle();

  return (meeting?.user_id as string | null) ?? null;
}

async function appendLiveConversationMetadata(
  supabase: SupabaseClient,
  externalBotId: string,
  segment: Omit<TranscriptSegment, "startMs" | "endMs">,
): Promise<void> {
  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("metadata")
    .eq("external_bot_id", externalBotId)
    .maybeSingle();

  if (!bot) return;

  const metadata = (bot.metadata as Record<string, unknown> | null) ?? {};
  const prior =
    (metadata.live_conversation as LiveConversationEntry[] | undefined) ?? [];
  const speaker = segment.speaker?.trim() || "Speaker";
  const text = segment.text?.trim() ?? "";
  if (!text) return;

  const entry: LiveConversationEntry = {
    speaker,
    text,
    at: new Date().toISOString(),
  };
  const last = prior[prior.length - 1];
  if (last?.speaker === entry.speaker && last?.text === entry.text) return;

  await supabase
    .from("meeting_bots")
    .update({
      metadata: {
        ...metadata,
        live_conversation: [...prior, entry].slice(-200),
        live_partial: null,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("external_bot_id", externalBotId);
}

export async function appendLiveTranscriptSegment(
  supabase: SupabaseClient,
  externalBotId: string,
  segment: Omit<TranscriptSegment, "startMs" | "endMs">,
): Promise<{ meetingId: string | null }> {
  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("meeting_id, user_id, bot_name, metadata")
    .eq("external_bot_id", externalBotId)
    .maybeSingle();

  if (!bot?.meeting_id) {
    return { meetingId: null };
  }

  const meetingId = bot.meeting_id as string;
  const botName = bot.bot_name as string | null;

  if (isBotSpeaker(segment.speaker, botName)) {
    return { meetingId };
  }

  const speaker = segment.speaker?.trim() || "Speaker";
  const text = segment.text?.trim() ?? "";
  if (!text) {
    return { meetingId };
  }

  await appendLiveConversationMetadata(supabase, externalBotId, segment);

  const userId = await resolveTranscriptUserId(
    supabase,
    meetingId,
    bot.user_id as string | null,
  );
  if (!userId) {
    return { meetingId };
  }

  const { data: existing } = await supabase
    .from("transcripts")
    .select("segments, full_text")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  const prior = (existing?.segments as TranscriptSegment[] | null) ?? [];
  const last = prior[prior.length - 1];
  if (last?.speaker === speaker && last?.text === text) {
    return { meetingId };
  }

  const segments = [...prior, { ...segment, speaker, text }];
  const fullText = segments
    .map((s) => `${s.speaker?.trim() || "Speaker"}: ${s.text}`)
    .join("\n");

  await supabase.from("transcripts").upsert(
    {
      meeting_id: meetingId,
      user_id: userId,
      full_text: fullText,
      segments,
    },
    { onConflict: "meeting_id" },
  );

  return { meetingId };
}

export async function setLiveTranscriptPreview(
  supabase: SupabaseClient,
  externalBotId: string,
  preview: { speaker: string; text: string } | null,
): Promise<void> {
  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("metadata, bot_name")
    .eq("external_bot_id", externalBotId)
    .maybeSingle();

  if (!bot) return;

  if (preview && isBotSpeaker(preview.speaker, bot.bot_name as string | null)) {
    return;
  }

  const metadata = (bot.metadata as Record<string, unknown> | null) ?? {};
  const next = { ...metadata };
  if (preview) {
    next.live_partial = preview;
  } else {
    delete next.live_partial;
  }

  await supabase
    .from("meeting_bots")
    .update({ metadata: next, updated_at: new Date().toISOString() })
    .eq("external_bot_id", externalBotId);
}
