import { NextResponse } from "next/server";
import {
  getRecallVoiceAgentDisplayName,
  getRecallVoiceAgentGreeting,
  getRecallVoiceAgentTeamLabel,
  isRecallVoiceAgentEnabled,
} from "@/lib/bot/recall-voice-agent";
import { hasOpenAI } from "@/lib/env";
import {
  createRealtimeCall,
  exchangeLegacyRealtimeSdp,
} from "@/lib/voice-agent/openai-realtime";
import { verifyVoiceAgentToken } from "@/lib/voice-agent/token";

export async function POST(request: Request) {
  if (!isRecallVoiceAgentEnabled()) {
    return NextResponse.json(
      { error: "Voice agent is disabled. Set RECALL_VOICE_AGENT_ENABLED=true." },
      { status: 403 },
    );
  }

  if (!hasOpenAI()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is required for the voice agent. Add credits at platform.openai.com.",
      },
      { status: 503 },
    );
  }

  let token: string | null = null;
  let botName: string | null = null;
  let sdp: string | null = null;

  try {
    const body = (await request.json()) as {
      token?: string | null;
      botName?: string | null;
      sdp?: string | null;
    };
    token = body.token ?? null;
    botName = body.botName?.trim() || null;
    sdp = body.sdp?.trim() || null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!verifyVoiceAgentToken(token)) {
    return NextResponse.json(
      { error: "Invalid or expired voice agent token." },
      { status: 401 },
    );
  }

  if (!sdp) {
    return NextResponse.json(
      { error: "Missing WebRTC offer SDP." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY!;

  try {
    const result = await createRealtimeCall(sdp, apiKey, botName);
    const greeting = getRecallVoiceAgentGreeting(botName ?? undefined);
    const displayName = getRecallVoiceAgentDisplayName(botName ?? undefined);
    const teamLabel = getRecallVoiceAgentTeamLabel();

    if (result.mode === "calls") {
      return NextResponse.json({
        mode: "calls",
        sdp: result.answerSdp,
        greeting,
        displayName,
        teamLabel,
      });
    }

    const answerSdp = await exchangeLegacyRealtimeSdp(
      sdp,
      result.clientSecret,
      result.model,
    );

    return NextResponse.json({
      mode: "legacy",
      sdp: answerSdp,
      greeting,
      displayName,
      teamLabel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Realtime connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
