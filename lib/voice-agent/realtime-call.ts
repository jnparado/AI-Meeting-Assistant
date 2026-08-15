import {
  getRecallVoiceAgentInstructions,
  getRecallVoiceAgentVoice,
  getRecallRealtimeModel,
} from "@/lib/bot/recall-voice-agent";
import { getVoiceAgentApiBase } from "@/lib/env";

export type RealtimeConnectResult =
  | { mode: "calls"; answerSdp: string }
  | {
      mode: "legacy";
      clientSecret: string;
      model: string;
      apiBase: string;
    };

function buildSessionPayload(botName?: string | null) {
  const model = getRecallRealtimeModel();
  const voice = getRecallVoiceAgentVoice();
  const instructions = getRecallVoiceAgentInstructions(botName ?? undefined);

  return {
    type: "realtime" as const,
    model,
    instructions,
    turn_detection: { type: "server_vad" as const },
    audio: {
      input: {
        turn_detection: { type: "server_vad" as const },
      },
      output: { voice },
    },
    voice,
    input_audio_transcription: { model: "whisper-1" },
  };
}

/** Unified WebRTC entrypoint (POST /v1/realtime/calls) — OpenAI + xAI compatible. */
export async function createRealtimeCall(
  offerSdp: string,
  apiKey: string,
  apiBase: string,
  botName?: string | null,
): Promise<RealtimeConnectResult> {
  const base = apiBase.replace(/\/$/, "");
  const session = JSON.stringify(buildSessionPayload(botName));
  const form = new FormData();
  form.set("sdp", offerSdp);
  form.set("session", session);

  const res = await fetch(`${base}/realtime/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const text = await res.text();
  if (res.ok) {
    return { mode: "calls", answerSdp: text };
  }

  if (res.status !== 404 && res.status !== 400) {
    throw new Error(`Realtime call failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return createLegacyRealtimeSession(apiKey, base, botName);
}

async function createLegacyRealtimeSession(
  apiKey: string,
  apiBase: string,
  botName?: string | null,
): Promise<RealtimeConnectResult> {
  const payload = buildSessionPayload(botName);
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/realtime/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: payload.model,
      voice: payload.voice,
      instructions: payload.instructions,
      turn_detection: payload.turn_detection,
      input_audio_transcription: payload.input_audio_transcription,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Realtime session failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const session = JSON.parse(text) as {
    client_secret?: { value?: string };
  };
  const clientSecret = session.client_secret?.value;
  if (!clientSecret) {
    throw new Error("Realtime API did not return a client secret.");
  }

  return {
    mode: "legacy",
    clientSecret,
    model: payload.model,
    apiBase: apiBase.replace(/\/$/, ""),
  };
}

export async function exchangeLegacyRealtimeSdp(
  offerSdp: string,
  clientSecret: string,
  model: string,
  apiBase?: string,
): Promise<string> {
  const base = (apiBase || getVoiceAgentApiBase()).replace(/\/$/, "");
  const res = await fetch(`${base}/realtime?model=${encodeURIComponent(model)}`, {
    method: "POST",
    body: offerSdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      "Content-Type": "application/sdp",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Realtime SDP exchange failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return text;
}
