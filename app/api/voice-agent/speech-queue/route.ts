import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { claimBotSpeech } from "@/lib/voice-agent/speech-queue";
import { verifyVoiceAgentToken } from "@/lib/voice-agent/token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const botId = url.searchParams.get("botId")?.trim();

  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }

  if (!verifyVoiceAgentToken(token)) {
    return NextResponse.json(
      { error: "Invalid or expired voice agent token." },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const items = await claimBotSpeech(supabase, botId);

  return NextResponse.json({ items });
}
