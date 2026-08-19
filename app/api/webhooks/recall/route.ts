import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getRecallApiBase } from "@/lib/bot/recall-config";
import { mapRecallStatus } from "@/lib/bot/recall";
import {
  persistMeetingResults,
  processTranscriptWithAI,
} from "@/lib/ai/summarize-meeting";
import type { TranscriptSegment } from "@/lib/types/database";
import { hasRecall } from "@/lib/env";
import { tryNotifyNoShowForMeeting } from "@/lib/follow-up/no-show";

export async function POST(request: Request) {
  const secret = request.headers.get("x-recall-webhook-secret");
  if (
    process.env.RECALL_WEBHOOK_SECRET &&
    secret !== process.env.RECALL_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const event = String(payload.event ?? "");
  const data = (payload.data ?? payload) as Record<string, unknown>;

  const supabase = createServiceClient();

  const botBlock = (data.bot ?? data) as {
    id?: string;
    metadata?: { internal_bot_id?: string };
  };
  const statusBlock = (data.data ?? data.status ?? {}) as {
    code?: string;
    sub_code?: string | null;
  };

  const botId = botBlock.metadata?.internal_bot_id;
  const externalId = botBlock.id;
  const statusCode =
    statusBlock.code ??
    (event.startsWith("bot.") ? event.slice("bot.".length) : undefined);

  const isBotEvent =
    event === "bot.status_change" ||
    event.startsWith("bot.") ||
    Boolean(statusCode);

  if (isBotEvent && statusCode) {
    const mapped = mapRecallStatus(statusCode);
    const patch: Record<string, unknown> = {
      status: mapped,
      updated_at: new Date().toISOString(),
    };

    if (statusCode === "in_call_not_recording" || statusCode === "joined") {
      patch.joined_at = new Date().toISOString();
    }
    if (statusCode === "in_call_recording" || statusCode === "recording") {
      patch.joined_at = new Date().toISOString();
      patch.recording_started_at = new Date().toISOString();
    }
    if (statusCode === "fatal" || statusCode === "failed") {
      patch.failure_reason = statusBlock.sub_code ?? "Recall bot failed";
    }
    if (statusCode === "done" || statusCode === "completed") {
      patch.completed_at = new Date().toISOString();
    }

    const query = supabase.from("meeting_bots").update(patch);
    if (botId) {
      await query.eq("id", botId);
    } else if (externalId) {
      await query.eq("external_bot_id", externalId);
    }

    const terminal = new Set([
      "meeting_ended",
      "completed",
      "failed",
      "cancelled",
    ]);
    if (terminal.has(mapped)) {
      const lookup = botId
        ? supabase.from("meeting_bots").select("meeting_id").eq("id", botId)
        : externalId
          ? supabase
              .from("meeting_bots")
              .select("meeting_id")
              .eq("external_bot_id", externalId)
          : null;
      if (lookup) {
        const { data: row } = await lookup.maybeSingle();
        if (row?.meeting_id) {
          void tryNotifyNoShowForMeeting(String(row.meeting_id)).catch((err) => {
            console.error("tryNotifyNoShowForMeeting:", err);
          });
        }
      }
    }
  }

  if (event === "bot.done" && externalId && hasRecall()) {
    void finalizeRecallBot(externalId, supabase).catch((err) => {
      console.error("finalizeRecallBot:", err);
    });
  }

  if (event === "transcript.done" || event === "recording.done") {
    await finalizeFromRecall(data, supabase);
  }

  return NextResponse.json({ received: true });
}

async function finalizeRecallBot(
  externalBotId: string,
  supabase: ReturnType<typeof createServiceClient>,
) {
  const res = await fetch(`${getRecallApiBase()}/api/v1/bot/${externalBotId}/`, {
    headers: { Authorization: `Token ${process.env.RECALL_API_KEY}` },
  });
  if (!res.ok) return;

  const botPayload = (await res.json()) as Record<string, unknown>;
  await finalizeFromRecall({ bot: botPayload, recording: botPayload }, supabase);
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
    (
      data.recording as {
        media_shortcuts?: { transcript?: { data?: { download_url?: string } } };
      }
    )?.media_shortcuts?.transcript?.data?.download_url ??
    (
      (data.bot as { recordings?: { media_shortcuts?: { transcript?: { data?: { download_url?: string } } } }[] })
        ?.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url
    );

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

  let insights;
  try {
    insights = await processTranscriptWithAI(meetingTitle, fullText, segments);
  } catch (err) {
    console.error("processTranscriptWithAI:", err);
    insights = {
      summary: fullText.slice(0, 500) || "Meeting recorded (AI summary unavailable).",
      key_topics: [],
      decisions: [],
      action_items: [],
    };
  }

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
      row.text ?? row.words?.map((w) => w.text ?? "").join(" ") ?? "";
    return { speaker: row.speaker, text };
  });
}
