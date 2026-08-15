import OpenAI from "openai";
import { hasOpenAI } from "@/lib/env";
import type { TranscriptSegment } from "@/lib/types/database";

export async function answerMeetingQuestion(
  meetingTitle: string,
  transcriptText: string,
  segments: TranscriptSegment[],
  question: string,
  options?: { live?: boolean },
): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) {
    return "Ask a question about this meeting.";
  }

  if (!hasOpenAI()) {
    const lower = trimmed.toLowerCase();
    if (lower.includes("action") || lower.includes("decision")) {
      return `From the transcript: ${transcriptText.slice(0, 500)}… (Add OPENAI_API_KEY for smarter answers.)`;
    }
    if (transcriptText) {
      return `Based on the transcript excerpt: ${transcriptText.slice(0, 400)}…`;
    }
    return `You asked: "${trimmed}". (Add OPENAI_API_KEY for AI replies during the meeting.)`;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const speakerLines = segments
    .slice(-40)
    .map((s) => `${s.speaker}: ${s.text}`)
    .join("\n");

  const liveHint = options?.live
    ? "The meeting may still be in progress — use only what is in the transcript so far. Keep answers brief."
    : "If the answer is not in the transcript, say so briefly.";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `You are MeetMind, an AI meeting assistant. Answer the user's message using the transcript when available, or respond helpfully to their instruction when the transcript is still empty. ${liveHint}`,
      },
      {
        role: "user",
        content: `Meeting: ${meetingTitle}\n\nTranscript so far:\n${transcriptText || speakerLines || "(still listening — no transcript yet)"}\n\nUser message: ${trimmed}`,
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "I could not generate an answer."
  );
}
