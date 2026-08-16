import type { TranscriptSegment } from "@/lib/types/database";

export type ConversationFeedItem = {
  id: string;
  kind: "participant" | "partial" | "your_reply";
  speaker: string;
  text: string;
  delivered?: boolean;
};

function segmentKey(speaker: string, text: string): string {
  return `${speaker.trim().toLowerCase()}:${text.trim()}`;
}

export function mergeTranscriptSegments(
  primary: TranscriptSegment[],
  fallback: TranscriptSegment[],
): TranscriptSegment[] {
  const seen = new Set<string>();
  const merged: TranscriptSegment[] = [];

  for (const seg of [...primary, ...fallback]) {
    const text = seg.text?.trim() ?? "";
    if (!text) continue;
    const key = segmentKey(seg.speaker ?? "Speaker", text);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      speaker: seg.speaker?.trim() || "Speaker",
      text,
    });
  }

  return merged;
}

export function buildConversationFeed(input: {
  segments: TranscriptSegment[];
  livePartial: { speaker: string; text: string } | null;
  sentScripts: { text: string; delivered: boolean }[];
  botName?: string | null;
}): ConversationFeedItem[] {
  const items: ConversationFeedItem[] = [];

  for (const [index, seg] of input.segments.entries()) {
    items.push({
      id: `seg-${index}-${seg.text.slice(0, 16)}`,
      kind: "participant",
      speaker: seg.speaker ?? "Speaker",
      text: seg.text,
    });
  }

  for (const [index, script] of input.sentScripts.entries()) {
    items.push({
      id: `script-${index}-${script.text.slice(0, 16)}`,
      kind: "your_reply",
      speaker: "You → Jerome",
      text: script.text,
      delivered: script.delivered,
    });
  }

  if (input.livePartial?.text?.trim()) {
    items.push({
      id: `partial-${input.livePartial.speaker}`,
      kind: "partial",
      speaker: input.livePartial.speaker,
      text: input.livePartial.text,
    });
  }

  return items;
}

export function getLastParticipantMessage(
  feed: ConversationFeedItem[],
): ConversationFeedItem | null {
  for (let i = feed.length - 1; i >= 0; i -= 1) {
    const item = feed[i];
    if (item.kind === "participant" || item.kind === "partial") {
      return item;
    }
  }
  return null;
}

export function draftReplyToMessage(message: ConversationFeedItem): string {
  return message.text.trim();
}
