import { randomUUID } from "node:crypto";
import type { createServiceClient } from "@/lib/supabase/server";

export type SpeechQueueItem = {
  id: string;
  text: string;
  createdAt: string;
  deliveredAt?: string | null;
};

type Supabase = ReturnType<typeof createServiceClient>;

function parseQueue(metadata: Record<string, unknown> | null): SpeechQueueItem[] {
  const raw = metadata?.speech_queue;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (row): row is SpeechQueueItem =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as SpeechQueueItem).id === "string" &&
        typeof (row as SpeechQueueItem).text === "string" &&
        typeof (row as SpeechQueueItem).createdAt === "string",
    )
    .slice(-50);
}

export async function enqueueBotSpeech(
  supabase: Supabase,
  botId: string,
  text: string,
): Promise<{ id: string }> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Text is required");
  }

  const { data: bot, error } = await supabase
    .from("meeting_bots")
    .select("metadata")
    .eq("id", botId)
    .single();

  if (error || !bot) {
    throw new Error("Bot not found");
  }

  const metadata = (bot.metadata as Record<string, unknown> | null) ?? {};
  const queue = parseQueue(metadata);
  const item: SpeechQueueItem = {
    id: randomUUID(),
    text: trimmed,
    createdAt: new Date().toISOString(),
    deliveredAt: null,
  };

  const nextQueue = [...queue, item].slice(-50);
  const { error: updateError } = await supabase
    .from("meeting_bots")
    .update({ metadata: { ...metadata, speech_queue: nextQueue } })
    .eq("id", botId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { id: item.id };
}

export async function claimBotSpeech(
  supabase: Supabase,
  botId: string,
): Promise<{ id: string; text: string }[]> {
  const { data: bot, error } = await supabase
    .from("meeting_bots")
    .select("metadata")
    .eq("id", botId)
    .single();

  if (error || !bot) {
    return [];
  }

  const metadata = (bot.metadata as Record<string, unknown> | null) ?? {};
  const queue = parseQueue(metadata);
  const now = new Date().toISOString();
  const claimed: { id: string; text: string }[] = [];

  const nextQueue = queue.map((item) => {
    if (!item.deliveredAt) {
      claimed.push({ id: item.id, text: item.text });
      return { ...item, deliveredAt: now };
    }
    return item;
  });

  if (claimed.length === 0) {
    return [];
  }

  await supabase
    .from("meeting_bots")
    .update({ metadata: { ...metadata, speech_queue: nextQueue } })
    .eq("id", botId);

  return claimed;
}
