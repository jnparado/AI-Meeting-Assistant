import { NextResponse } from "next/server";
import {
  getRecallVoiceAgentDisplayName,
  getRecallVoiceAgentInstructions,
  getRecallVoiceAgentOutputGain,
  getRecallVoiceAgentTeamLabel,
  getRecallVoiceAgentVoice,
  isRecallVoiceAgentEnabled,
} from "@/lib/bot/recall-voice-agent";
import {
  getVoiceAgentApiBase,
  getVoiceAgentApiKey,
  getVoiceAgentProvider,
  hasVoiceAgentLlm,
} from "@/lib/env";
import {
  createRealtimeCall,
  exchangeLegacyRealtimeSdp,
} from "@/lib/voice-agent/realtime-call";
import { createXaiClientSecret } from "@/lib/voice-agent/xai-realtime";
import { verifyVoiceAgentToken } from "@/lib/voice-agent/token";

export async function POST(request: Request) {
  if (!isRecallVoiceAgentEnabled()) {
    return NextResponse.json(
      { error: "Voice agent is disabled. Set RECALL_VOICE_AGENT_ENABLED=true." },
      { status: 403 },
    );
  }

  if (!hasVoiceAgentLlm()) {
    return NextResponse.json(
      {
        error:
          "Set XAI_API_KEY (Grok Voice) or OPENAI_API_KEY for the talking bot.",
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

  const apiKey = getVoiceAgentApiKey()!;
  const provider = getVoiceAgentProvider();
  const displayName = getRecallVoiceAgentDisplayName(botName ?? undefined);
  const teamLabel = getRecallVoiceAgentTeamLabel();
  const greeting = "";

  try {
    if (provider === "xai") {
      const xai = await createXaiClientSecret(apiKey, botName);
      return NextResponse.json({
        mode: "websocket",
        provider,
        clientSecret: xai.clientSecret,
        wsUrl: xai.wsUrl,
        model: xai.model,
        voice: xai.voice,
        instructions: xai.instructions,
        greeting,
        displayName,
        teamLabel,
        outputGain: getRecallVoiceAgentOutputGain(),
      });
    }

    if (!sdp) {
      return NextResponse.json(
        { error: "Missing WebRTC offer SDP." },
        { status: 400 },
      );
    }

    const apiBase = getVoiceAgentApiBase();
    const result = await createRealtimeCall(sdp, apiKey, apiBase, botName);

    if (result.mode === "calls") {
      return NextResponse.json({
        mode: "webrtc",
        provider,
        sdp: result.answerSdp,
        greeting,
        displayName,
        teamLabel,
        outputGain: getRecallVoiceAgentOutputGain(),
      });
    }

    const answerSdp = await exchangeLegacyRealtimeSdp(
      sdp,
      result.clientSecret,
      result.model,
      result.apiBase,
    );

    return NextResponse.json({
      mode: "webrtc",
      provider,
      sdp: answerSdp,
      greeting,
      displayName,
      teamLabel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Realtime connection failed";
    console.error("[voice-agent/session]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
