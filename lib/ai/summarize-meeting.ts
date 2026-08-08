import OpenAI from "openai";
import { z } from "zod";
import { hasOpenAI } from "@/lib/env";
import type { ActionItem, TranscriptSegment } from "@/lib/types/database";

const summarySchema = z.object({
  summary: z.string(),
  decisions: z.array(z.string()),
  action_items: z.array(
    z.object({
      task: z.string(),
      owner: z.string().optional(),
      due: z.string().optional(),
    }),
  ),
  key_topics: z.array(z.string()),
});

export type MeetingInsights = z.infer<typeof summarySchema>;

export async function processTranscriptWithAI(
  meetingTitle: string,
  transcriptText: string,
  segments: TranscriptSegment[],
): Promise<MeetingInsights> {
  if (!hasOpenAI()) {
    return fallbackInsights(meetingTitle, transcriptText);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You analyze meeting transcripts. Return JSON with keys: summary (string), decisions (string[]), action_items ({task, owner?, due?}[]), key_topics (string[]). Be concise and factual.",
      },
      {
        role: "user",
        content: `Meeting: ${meetingTitle}\n\nTranscript:\n${transcriptText || "(empty)"}\n\nSegments:\n${JSON.stringify(segments.slice(0, 50))}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = summarySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return fallbackInsights(meetingTitle, transcriptText);
  }
  return parsed.data;
}

function fallbackInsights(
  meetingTitle: string,
  transcriptText: string,
): MeetingInsights {
  const snippet = transcriptText.slice(0, 280) || "No speech captured.";
  return {
    summary: `Notes for "${meetingTitle}": ${snippet}`,
    decisions: [],
    action_items: [],
    key_topics: ["General discussion"],
  };
}

export async function persistMeetingResults(
  meetingId: string,
  userId: string,
  transcriptText: string,
  segments: TranscriptSegment[],
  participantEvents: unknown[],
  insights: MeetingInsights,
) {
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = createServiceClient();

  await supabase.from("transcripts").upsert(
    {
      meeting_id: meetingId,
      user_id: userId,
      full_text: transcriptText,
      segments,
      participant_events: participantEvents,
    },
    { onConflict: "meeting_id" },
  );

  await supabase.from("meeting_summaries").upsert(
    {
      meeting_id: meetingId,
      user_id: userId,
      summary: insights.summary,
      decisions: insights.decisions,
      action_items: insights.action_items,
      key_topics: insights.key_topics,
    },
    { onConflict: "meeting_id" },
  );

  await supabase
    .from("meeting_bots")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("meeting_id", meetingId);

  const { queueFollowUpsForMeeting, processFollowUpsForMeeting } =
    await import("@/lib/follow-up/dispatch");
  await queueFollowUpsForMeeting(meetingId, userId, insights);
  await processFollowUpsForMeeting(meetingId).catch((err) => {
    console.error("processFollowUpsForMeeting failed:", err);
  });
}
