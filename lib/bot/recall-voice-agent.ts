import { getRecallPublicAppUrl } from "@/lib/bot/recall-config";
import { getAppUrl, hasOpenAI } from "@/lib/env";
import { getDefaultBotName } from "@/lib/bot/default-bot-name";
import { createVoiceAgentToken } from "@/lib/voice-agent/token";

export const DEFAULT_RECALL_REALTIME_MODEL =
  "gpt-4o-realtime-preview-2024-12-17";

export function getRecallRealtimeModel(): string {
  return (
    process.env.RECALL_VOICE_AGENT_MODEL?.trim() || DEFAULT_RECALL_REALTIME_MODEL
  );
}

const DEFAULT_AGENT_NAME = "John";
const DEFAULT_AGENT_TEAM = "AdSense team";

const DEFAULT_GREETING =
  "Hi, my name is John from the AdSense team. Nice to meet you.";

const DEFAULT_INSTRUCTIONS = `You are John from the AdSense team, joining a live video meeting as a friendly assistant.
Keep replies short (1–3 sentences). Listen to participants, answer questions clearly,
and help summarize or clarify when asked. Be natural and conversational. You may say your name is John from the AdSense team when helpful.`;

export function isRecallVoiceAgentEnabled(): boolean {
  const v = process.env.RECALL_VOICE_AGENT_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function canUseRecallVoiceAgent(): boolean {
  return (
    isRecallVoiceAgentEnabled() &&
    hasOpenAI() &&
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
  return meetName.split(/\s+/)[0] || DEFAULT_AGENT_NAME;
}

export function getRecallVoiceAgentTeamLabel(): string {
  return process.env.RECALL_VOICE_AGENT_TEAM?.trim() || DEFAULT_AGENT_TEAM;
}

export function getRecallVoiceAgentVoice(): string {
  return process.env.RECALL_VOICE_AGENT_VOICE?.trim() || "verse";
}

export function getRecallVoiceAgentPageUrl(botName?: string): string | null {
  if (!canUseRecallVoiceAgent()) return null;

  const base = getRecallPublicAppUrl().replace(/\/$/, "");
  const url = new URL(`${base}/bot-agent`);
  const token = createVoiceAgentToken();
  if (token) url.searchParams.set("token", token);
  const name = botName?.trim() || getDefaultBotName();
  if (name) url.searchParams.set("botName", name);
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

export function getRecallVoiceAgentExtras(botName?: string): RecallVoiceAgentExtras {
  const pageUrl = getRecallVoiceAgentPageUrl(botName);
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
    "(Recall cannot load localhost). Run: npm run recall:tunnel (Cloudflare, no browser gate) — then restart dev server and send a new bot. " +
    "Docs: https://docs.recall.ai/docs/stream-media"
  );
}
