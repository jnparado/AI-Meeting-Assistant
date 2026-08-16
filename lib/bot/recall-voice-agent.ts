import { getRecallPublicAppUrl } from "@/lib/bot/recall-config";
import { updateRecallBotOutputMedia } from "@/lib/bot/recall";
import { getVoiceAgentProvider, hasVoiceAgentLlm } from "@/lib/env";
import { getDefaultBotName } from "@/lib/bot/default-bot-name";
import { createVoiceAgentToken } from "@/lib/voice-agent/token";

export const DEFAULT_OPENAI_REALTIME_MODEL =
  "gpt-4o-realtime-preview-2024-12-17";
export const DEFAULT_XAI_REALTIME_MODEL = "grok-voice-latest";

export function getRecallRealtimeModel(): string {
  const custom = process.env.RECALL_VOICE_AGENT_MODEL?.trim();
  if (custom) return custom;
  return getVoiceAgentProvider() === "xai"
    ? DEFAULT_XAI_REALTIME_MODEL
    : DEFAULT_OPENAI_REALTIME_MODEL;
}

const DEFAULT_AGENT_NAME = "Jerome";
const DEFAULT_AGENT_TEAM = "AdMob";

const DEFAULT_GREETING = "Hi, my name is Jerome from AdMob.";

const DEFAULT_INSTRUCTIONS = `You are Jerome from AdMob, joining a live video meeting as a friendly assistant.
Keep replies short (1–3 sentences). Listen to participants, answer questions clearly,
and help summarize or clarify when asked. Be natural and conversational. You may say your name is Jerome from AdMob when helpful.`;

const DEFAULT_OUTPUT_GAIN = 2.5;

export function isRecallVoiceAgentEnabled(): boolean {
  const v = process.env.RECALL_VOICE_AGENT_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function canUseRecallVoiceAgent(): boolean {
  return (
    isRecallVoiceAgentEnabled() &&
    hasVoiceAgentLlm() &&
    isRecallVoiceAgentUrlConfigured()
  );
}

export function isRecallVoiceAgentUrlConfigured(): boolean {
  const url = getRecallPublicAppUrl();
  return (
    url.startsWith("https://") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  );
}

/** Spoken once when the bot connects to the meeting. */
export function getRecallVoiceAgentGreeting(botName?: string): string {
  const custom = process.env.RECALL_VOICE_AGENT_GREETING?.trim();
  if (custom) return custom;

  const meetName = botName?.trim() || getDefaultBotName();
  if (/adsense\s+john/i.test(meetName) || meetName.toLowerCase() === "john") {
    return DEFAULT_GREETING;
  }
  if (/jerome/i.test(meetName)) {
    return DEFAULT_GREETING;
  }

  return `Hi, my name is ${meetName}. Nice to meet you.`;
}

export function getRecallVoiceAgentInstructions(botName?: string): string {
  const base =
    process.env.RECALL_VOICE_AGENT_INSTRUCTIONS?.trim() || DEFAULT_INSTRUCTIONS;
  const greeting = getRecallVoiceAgentGreeting(botName);
  return `${base}\n\nWhen the meeting starts, your first words must be exactly: "${greeting}" Then listen and respond briefly.`;
}

export function getRecallVoiceAgentDisplayName(botName?: string): string {
  if (process.env.RECALL_VOICE_AGENT_NAME?.trim()) {
    return process.env.RECALL_VOICE_AGENT_NAME.trim();
  }
  const meetName = botName?.trim() || getDefaultBotName();
  if (/adsense\s+john/i.test(meetName)) return "John";
  if (/jerome/i.test(meetName)) return "Jerome";
  return meetName.split(/\s+/)[0] || DEFAULT_AGENT_NAME;
}

export function getRecallVoiceAgentOutputGain(): number {
  const raw = process.env.RECALL_VOICE_AGENT_OUTPUT_GAIN?.trim();
  if (!raw) return DEFAULT_OUTPUT_GAIN;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_OUTPUT_GAIN;
  return Math.min(value, 4);
}

export function getRecallVoiceAgentTeamLabel(): string {
  return process.env.RECALL_VOICE_AGENT_TEAM?.trim() || DEFAULT_AGENT_TEAM;
}

export function getRecallVoiceAgentVoice(): string {
  const custom = process.env.RECALL_VOICE_AGENT_VOICE?.trim();
  if (custom) return custom;
  return getVoiceAgentProvider() === "xai" ? "leo" : "verse";
}

export function getRecallVoiceAgentPageUrl(
  botName?: string,
  botId?: string,
): string | null {
  if (!canUseRecallVoiceAgent()) return null;

  const base = getRecallPublicAppUrl().replace(/\/$/, "");
  const url = new URL(`${base}/bot-agent`);
  const token = createVoiceAgentToken();
  if (token) url.searchParams.set("token", token);
  const name = botName?.trim() || getDefaultBotName();
  if (name) url.searchParams.set("botName", name);
  if (botId?.trim()) url.searchParams.set("botId", botId.trim());
  return url.toString();
}

export type RecallVoiceAgentExtras = {
  output_media?: {
    camera: {
      kind: "webpage";
      config: { url: string };
    };
  };
  variant?: {
    zoom: "web_4_core";
    google_meet: "web_4_core";
    microsoft_teams: "web_4_core";
  };
  recording_config?: {
    include_bot_in_recording: { audio: boolean };
  };
};

export function getRecallVoiceAgentExtras(
  botName?: string,
  botId?: string,
): RecallVoiceAgentExtras {
  const pageUrl = getRecallVoiceAgentPageUrl(botName, botId);
  if (!pageUrl) return {};

  return {
    output_media: {
      camera: {
        kind: "webpage",
        config: { url: pageUrl },
      },
    },
    variant: {
      zoom: "web_4_core",
      google_meet: "web_4_core",
      microsoft_teams: "web_4_core",
    },
    recording_config: {
      include_bot_in_recording: { audio: true },
    },
  };
}

export function getRecallVoiceAgentSetupHint(): string {
  return (
    "Voice agent needs RECALL_PUBLIC_APP_URL=https://your-cloudflare-or-vercel-url " +
    "(Recall cannot load localhost). Run: npm run recall:tunnel (Cloudflare, no browser gate) — keep that terminal open, restart dev server, then send a new bot. " +
    "Docs: https://docs.recall.ai/docs/stream-media"
  );
}

/** Point an in-call Recall bot at the current voice-agent page (fixes stale tunnel URLs). */
export async function refreshRecallVoiceAgentOutputMedia(
  externalBotId: string,
  botName?: string,
  botId?: string,
): Promise<string | null> {
  const pageUrl = getRecallVoiceAgentPageUrl(botName, botId);
  if (!pageUrl) return null;
  await updateRecallBotOutputMedia(externalBotId, pageUrl);
  return pageUrl;
}
