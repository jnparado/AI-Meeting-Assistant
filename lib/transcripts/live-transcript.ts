import type { SupabaseClient } from "@supabase/supabase-js";
import type { TranscriptSegment } from "@/lib/types/database";

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
  const bot = (root.bot ?? payload.bot) as { id?: string };
  const externalBotId = bot?.id?.trim();
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

export async function appendLiveTranscriptSegment(
  supabase: SupabaseClient,
  externalBotId: string,
  segment: Omit<TranscriptSegment, "startMs" | "endMs">,
): Promise<{ meetingId: string | null }> {
  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("meeting_id, user_id")
    .eq("external_bot_id", externalBotId)
    .maybeSingle();

  if (!bot?.meeting_id || !bot.user_id) {
    return { meetingId: null };
  }

  const { data: existing } = await supabase
    .from("transcripts")
    .select("segments, full_text")
    .eq("meeting_id", bot.meeting_id)
    .maybeSingle();

  const prior = (existing?.segments as TranscriptSegment[] | null) ?? [];
  const last = prior[prior.length - 1];
  if (last?.speaker === segment.speaker && last?.text === segment.text) {
    return { meetingId: bot.meeting_id as string };
  }

  const segments = [...prior, segment];
  const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");

  await supabase.from("transcripts").upsert(
    {
      meeting_id: bot.meeting_id,
      user_id: bot.user_id,
      full_text: fullText,
      segments,
    },
    { onConflict: "meeting_id" },
  );

  return { meetingId: bot.meeting_id as string };
}

export async function setLiveTranscriptPreview(
  supabase: SupabaseClient,
  externalBotId: string,
  preview: { speaker: string; text: string } | null,
): Promise<void> {
  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("metadata")
    .eq("external_bot_id", externalBotId)
    .maybeSingle();

  if (!bot) return;

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
