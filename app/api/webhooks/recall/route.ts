import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { mapRecallStatus } from "@/lib/bot/recall";
import {
  persistMeetingResults,
  processTranscriptWithAI,
} from "@/lib/ai/summarize-meeting";
import type { TranscriptSegment } from "@/lib/types/database";

export async function POST(request: Request) {
  const secret = request.headers.get("x-recall-webhook-secret");
  if (
    process.env.RECALL_WEBHOOK_SECRET &&
    secret !== process.env.RECALL_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const event = payload.event as string;
  const data = payload.data ?? payload;

  const supabase = createServiceClient();

  if (event === "bot.status_change") {
    const botId = data.bot?.metadata?.internal_bot_id as string | undefined;
    const externalId = data.bot?.id as string | undefined;
    const statusCode = data.status?.code as string;

    const query = supabase.from("meeting_bots").update({
      status: mapRecallStatus(statusCode),
      updated_at: new Date().toISOString(),
      ...(statusCode === "in_call_not_recording"
        ? { joined_at: new Date().toISOString() }
        : {}),
      ...(statusCode === "in_call_recording"
        ? {
            joined_at: new Date().toISOString(),
            recording_started_at: new Date().toISOString(),
          }
        : {}),
    });

    if (botId) {
      await query.eq("id", botId);
    } else if (externalId) {
      await query.eq("external_bot_id", externalId);
    }
  }

  if (event === "transcript.done" || event === "recording.done") {
    await finalizeFromRecall(data, supabase);
  }

  return NextResponse.json({ received: true });
}

async function finalizeFromRecall(
  data: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceClient>,
) {
  const externalBotId =
    (data.bot as { id?: string })?.id ??
    (data.recording as { bot_id?: string })?.bot_id;

  if (!externalBotId) return;

  await supabase
    .from("meeting_bots")
    .update({ status: "processing" })
    .eq("external_bot_id", externalBotId);

  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("*, meetings(title)")
    .eq("external_bot_id", externalBotId)
    .single();

  if (!bot) return;

  const transcriptUrl =
    (data.transcript as { download_url?: string })?.download_url ??
    (data.recording as { media_shortcuts?: { transcript?: { download_url?: string } } })
      ?.media_shortcuts?.transcript?.download_url;

  let segments: TranscriptSegment[] = [];
  let fullText = "";

  if (transcriptUrl) {
    const tRes = await fetch(transcriptUrl);
    if (tRes.ok) {
      const raw = await tRes.json();
      segments = normalizeRecallTranscript(raw);
      fullText = segments.map((s) => s.text).join("\n");
    }
  }

  const meetingTitle =
    (bot.meetings as { title?: string } | null)?.title ?? "Meeting";

  const insights = await processTranscriptWithAI(meetingTitle, fullText, segments);

  await persistMeetingResults(
    bot.meeting_id,
    bot.user_id,
    fullText,
    segments,
    [],
    insights,
  );
}

function normalizeRecallTranscript(raw: unknown): TranscriptSegment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as {
      speaker?: string;
      words?: { text?: string }[];
      text?: string;
    };
    const text =
      row.text ??
      row.words?.map((w) => w.text ?? "").join(" ") ??
      "";
    return { speaker: row.speaker, text };
  });
}
