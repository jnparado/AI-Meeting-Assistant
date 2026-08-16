import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  markBotSpeechDelivered,
  peekBotSpeech,
} from "@/lib/voice-agent/speech-queue";
import { resolveVoiceAgentBotId } from "@/lib/voice-agent/resolve-voice-agent-bot";
import { verifyVoiceAgentToken } from "@/lib/voice-agent/token";

async function verifyRequest(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const botIdParam = url.searchParams.get("botId")?.trim() ?? null;
  const botName = url.searchParams.get("botName")?.trim() ?? null;

  if (!verifyVoiceAgentToken(token)) {
    return {
      error: NextResponse.json(
        { error: "Invalid or expired voice agent token." },
        { status: 401 },
      ),
    };
  }

  const botId = await resolveVoiceAgentBotId({
    botId: botIdParam,
    token,
    botName,
  });

  if (!botId) {
    return {
      error: NextResponse.json(
        { error: "No active bot found for this voice agent session." },
        { status: 404 },
      ),
    };
  }

  return { botId, token, botName };
}

export async function GET(request: Request) {
  const verified = await verifyRequest(request);
  if ("error" in verified && verified.error) return verified.error;

  const supabase = createServiceClient();
  const pending = await peekBotSpeech(supabase, verified.botId!);
  const items = pending.slice(0, 1);

  return NextResponse.json({ items, botId: verified.botId });
}

export async function POST(request: Request) {
  const verified = await verifyRequest(request);
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
