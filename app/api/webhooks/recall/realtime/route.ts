import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  appendLiveTranscriptSegment,
  parseRecallLiveTranscriptPayload,
  setLiveTranscriptPreview,
} from "@/lib/transcripts/live-transcript";

function verifyToken(request: Request): boolean {
  const expected =
    process.env.RECALL_REALTIME_WEBHOOK_TOKEN?.trim() ||
    process.env.RECALL_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!expected) return true;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  return token === expected;
}

export async function POST(request: Request) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const parsed = parseRecallLiveTranscriptPayload(payload);
  if (!parsed) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const supabase = createServiceClient();

  if (parsed.isPartial) {
    void setLiveTranscriptPreview(supabase, parsed.externalBotId, {
      speaker: parsed.speaker,
      text: parsed.text,
    }).catch((err) => console.error("setLiveTranscriptPreview:", err));
    return NextResponse.json({ received: true, partial: true });
  }

  void appendLiveTranscriptSegment(supabase, parsed.externalBotId, {
    speaker: parsed.speaker,
    text: parsed.text,
  })
    .then(() =>
      setLiveTranscriptPreview(supabase, parsed.externalBotId, null),
    )
    .catch((err) => console.error("appendLiveTranscriptSegment:", err));

  return NextResponse.json({ received: true });
}
