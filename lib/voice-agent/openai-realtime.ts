import {
  getRecallRealtimeModel,
  getRecallVoiceAgentInstructions,
  getRecallVoiceAgentVoice,
} from "@/lib/bot/recall-voice-agent";

export type RealtimeConnectResult =
  | { mode: "calls"; answerSdp: string }
  | {
      mode: "legacy";
      clientSecret: string;
      model: string;
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
    // Legacy session fields — ignored by newer API if unsupported.
    voice,
    input_audio_transcription: { model: "whisper-1" },
  };
}

/** OpenAI unified WebRTC entrypoint (POST /v1/realtime/calls). */
export async function createRealtimeCall(
  offerSdp: string,
  apiKey: string,
  botName?: string | null,
): Promise<RealtimeConnectResult> {
  const session = JSON.stringify(buildSessionPayload(botName));
  const form = new FormData();
  form.set("sdp", offerSdp);
  form.set("session", session);

  const res = await fetch("https://api.openai.com/v1/realtime/calls", {
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
    throw new Error(`OpenAI Realtime call failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return createLegacyRealtimeSession(apiKey, botName);
}

/** Fallback for accounts still on ephemeral session tokens. */
async function createLegacyRealtimeSession(
  apiKey: string,
  botName?: string | null,
): Promise<RealtimeConnectResult> {
  const payload = buildSessionPayload(botName);
  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
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
    throw new Error(`OpenAI Realtime session failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const session = JSON.parse(text) as {
    client_secret?: { value?: string };
  };
  const clientSecret = session.client_secret?.value;
  if (!clientSecret) {
    throw new Error("OpenAI did not return a Realtime client secret.");
  }

  return {
    mode: "legacy",
    clientSecret,
    model: payload.model,
  };
}

export async function exchangeLegacyRealtimeSdp(
  offerSdp: string,
  clientSecret: string,
  model: string,
): Promise<string> {
  const res = await fetch(
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    {
      method: "POST",
      body: offerSdp,
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI Realtime SDP exchange failed (${res.status}): ${text.slice(0, 400)}`);
  }

  return text;
}
