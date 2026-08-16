import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  markBotSpeechDelivered,
  peekBotSpeech,
} from "@/lib/voice-agent/speech-queue";
import { verifyVoiceAgentToken } from "@/lib/voice-agent/token";

function verifyRequest(request: Request, botId: string | null) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!botId) {
    return { error: NextResponse.json({ error: "botId is required" }, { status: 400 }) };
  }

  if (!verifyVoiceAgentToken(token)) {
    return {
      error: NextResponse.json(
        { error: "Invalid or expired voice agent token." },
        { status: 401 },
      ),
    };
  }

  return { botId, token };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const botId = url.searchParams.get("botId")?.trim() ?? null;
  const verified = verifyRequest(request, botId);
  if ("error" in verified && verified.error) return verified.error;

  const supabase = createServiceClient();
  const items = await peekBotSpeech(supabase, verified.botId!);

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const botId = url.searchParams.get("botId")?.trim() ?? null;
  const verified = verifyRequest(request, botId);
  if ("error" in verified && verified.error) return verified.error;

  const body = (await request.json()) as { deliveredIds?: string[] };
  const deliveredIds = Array.isArray(body.deliveredIds)
    ? body.deliveredIds.filter((id) => typeof id === "string")
    : [];

  const supabase = createServiceClient();
  const marked = await markBotSpeechDelivered(
    supabase,
    verified.botId!,
    deliveredIds,
  );

  return NextResponse.json({ ok: true, marked });
}
