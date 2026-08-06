import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  persistMeetingResults,
  processTranscriptWithAI,
} from "@/lib/ai/summarize-meeting";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";

type SimulationBody = {
  internalBotId: string;
  meetingTitle: string;
  botName?: string;
  delayMs?: number;
};

const STATUS_FLOW: BotStatus[] = [
  "joining",
  "waiting_room",
  "joined",
  "recording",
  "meeting_ended",
  "processing",
];

export async function POST(request: Request) {
  const body = (await request.json()) as SimulationBody;
  const { internalBotId, meetingTitle, botName, delayMs = 0 } = body;

  if (!internalBotId) {
    return NextResponse.json({ error: "Missing bot id" }, { status: 400 });
  }

  void runSimulation(internalBotId, meetingTitle, botName, delayMs);

  return NextResponse.json({ ok: true });
}

async function runSimulation(
  internalBotId: string,
  meetingTitle: string,
  botName: string | undefined,
  initialDelayMs: number,
) {
  await sleep(initialDelayMs);
  const supabase = createServiceClient();

  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("*")
    .eq("id", internalBotId)
    .single();

  if (!bot || bot.status === "cancelled") return;

  for (const status of STATUS_FLOW) {
    await supabase
      .from("meeting_bots")
      .update({
        status,
        ...(status === "joined"
          ? { joined_at: new Date().toISOString() }
          : {}),
        ...(status === "recording"
          ? { recording_started_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", internalBotId);
    await sleep(700);
  }

  const displayName = botName ?? bot.bot_name ?? "AI Meeting Assistant";

  const segments: TranscriptSegment[] = [
    {
      speaker: "Host",
      text: `Welcome everyone. ${displayName} is recording and transcribing this meeting.`,
    },
    {
      speaker: "Participant",
      text: "We agreed to ship the dashboard by Friday and assign QA to Morgan.",
    },
    {
      speaker: "Host",
      text: "Decision: move the launch to next Tuesday if blockers remain.",
    },
  ];

  const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
  const insights = await processTranscriptWithAI(meetingTitle, fullText, segments);

  await persistMeetingResults(
    bot.meeting_id,
    bot.user_id,
    fullText,
    segments,
    [
      { type: "join", participant: displayName },
      { type: "announcement", message: "Recording and transcription enabled" },
    ],
    insights,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
