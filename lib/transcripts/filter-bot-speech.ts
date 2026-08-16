import type { TranscriptSegment } from "@/lib/types/database";

const BOT_SPEAKER_HINTS = ["adsense john", "meetmind", "notetaker", "recall"];

export function isBotSpeaker(
  speaker: string | null | undefined,
  botName?: string | null,
): boolean {
  const normalized = speaker?.trim().toLowerCase() ?? "";
  if (!normalized) return false;

  const name = botName?.trim().toLowerCase();
  if (name && normalized === name) {
    return true;
  }

  return BOT_SPEAKER_HINTS.some((hint) => normalized === hint);
}

export function filterBotTranscriptSegments(
  segments: TranscriptSegment[],
  botName?: string | null,
): TranscriptSegment[] {
  return segments.filter((seg) => !isBotSpeaker(seg.speaker, botName));
}

export function expandIntroSpeakLines(
  text: string,
  greeting: string,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const introMatch = trimmed.match(
    /^(.*)\.?\s*now can you introduce (?:your\s*self|yourself)\.?\s*$/i,
  );
  if (introMatch) {
    const prefix = introMatch[1]?.trim().replace(/\.$/, "") ?? "";
    const lines: string[] = [];
    if (prefix) lines.push(prefix);
    const greetingTrimmed = greeting.trim();
    if (
      greetingTrimmed &&
      !prefix.toLowerCase().includes(greetingTrimmed.toLowerCase())
    ) {
      lines.push(greetingTrimmed);
    }
    return lines.length > 0 ? lines : [trimmed];
  }

  return [trimmed];
}
