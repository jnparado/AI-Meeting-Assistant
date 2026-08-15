import {
  getRecallRealtimeModel,
  getRecallVoiceAgentInstructions,
  getRecallVoiceAgentVoice,
} from "@/lib/bot/recall-voice-agent";
import { getGrokBaseUrl } from "@/lib/env";

export type XaiClientSecretResult = {
  clientSecret: string;
  expiresAt: number | null;
  model: string;
  voice: string;
  instructions: string;
  wsUrl: string;
};

export async function createXaiClientSecret(
  apiKey: string,
  botName?: string | null,
): Promise<XaiClientSecretResult> {
  const model = getRecallRealtimeModel();
  const voice = getRecallVoiceAgentVoice();
  const instructions = getRecallVoiceAgentInstructions(botName ?? undefined);
  const base = getGrokBaseUrl().replace(/\/$/, "");

  const res = await fetch(`${base}/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: 3600 },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Grok Voice token failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const data = JSON.parse(text) as {
    client_secret?: { value?: string; expires_at?: number };
    value?: string;
  };

  const clientSecret = data.client_secret?.value ?? data.value;
  if (!clientSecret) {
    throw new Error("Grok Voice did not return a client secret.");
  }

  return {
    clientSecret,
    expiresAt: data.client_secret?.expires_at ?? null,
    model,
    voice,
    instructions,
    wsUrl: `wss://api.x.ai/v1/realtime?model=${encodeURIComponent(model)}`,
  };
}
