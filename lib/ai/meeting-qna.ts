import OpenAI from "openai";
import { hasOpenAI } from "@/lib/env";
import type { TranscriptSegment } from "@/lib/types/database";

export async function answerMeetingQuestion(
  meetingTitle: string,
  transcriptText: string,
  segments: TranscriptSegment[],
  question: string,
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
    return `Based on the transcript excerpt: ${transcriptText.slice(0, 400)}…`;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const speakerLines = segments
    .slice(0, 80)
    .map((s) => `${s.speaker}: ${s.text}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You answer questions about a meeting using only the transcript. Cite speakers when relevant. If the answer is not in the transcript, say so briefly.",
      },
      {
        role: "user",
        content: `Meeting: ${meetingTitle}\n\nTranscript:\n${transcriptText || speakerLines || "(empty)"}\n\nQuestion: ${trimmed}`,
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "I could not generate an answer."
  );
}
