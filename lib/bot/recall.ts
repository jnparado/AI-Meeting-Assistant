import { getBotSimulationSecret, hasRecall } from "@/lib/env";
import {
  getRecallApiBase,
  getRecallGoogleMeetBotConfig,
  getRecallGoogleLoginSetupHint,
  getRecallSetupHint,
} from "@/lib/bot/recall-config";
import { getRecallVoiceAgentExtras, getRecallVoiceAgentSetupHint, isRecallVoiceAgentEnabled, isRecallVoiceAgentUrlConfigured } from "@/lib/bot/recall-voice-agent";
import { getRecallRealtimeEndpoints } from "@/lib/bot/recall-realtime";
import type { BotStatus } from "@/lib/types/database";

export type ScheduleBotInput = {
  meetingUrl: string;
  meetingTitle: string;
  joinAt: Date;
  botId: string;
  botName: string;
  joinNow?: boolean;
};

export type ScheduleBotResult = {
  externalBotId: string;
  provider: "recall" | "simulation";
};

const RECALL_RETRY_STATUSES = new Set([507, 502, 503, 429]);
const RECALL_MAX_ATTEMPTS = 4;

export async function scheduleMeetingBot(
  input: ScheduleBotInput,
): Promise<ScheduleBotResult> {
  if (hasRecall()) {
    return scheduleRecallBot(input);
  }
  return scheduleSimulatedBot(input);
}

async function scheduleRecallBot(
  input: ScheduleBotInput,
): Promise<ScheduleBotResult> {
  const apiBase = getRecallApiBase();
  const joinAt =
    input.joinAt.getTime() <= Date.now() ? null : input.joinAt.toISOString();

  if (isRecallVoiceAgentEnabled() && !isRecallVoiceAgentUrlConfigured()) {
    throw new Error(
      "RECALL_VOICE_AGENT_ENABLED is on but RECALL_PUBLIC_APP_URL is missing or localhost. " +
        getRecallVoiceAgentSetupHint(),
    );
  }

  const googleMeet = getRecallGoogleMeetBotConfig();
  const voiceExtras = getRecallVoiceAgentExtras(input.botName, input.botId);
  const realtimeEndpoints = getRecallRealtimeEndpoints();
  const body = {
    meeting_url: input.meetingUrl,
    bot_name: input.botName,
    ...(joinAt ? { join_at: joinAt } : {}),
    ...(googleMeet ? { google_meet: googleMeet } : {}),
    ...(voiceExtras.output_media
      ? { output_media: voiceExtras.output_media }
      : {}),
    ...(voiceExtras.variant ? { variant: voiceExtras.variant } : {}),
    recording_config: {
      transcript: {
        provider: {
          recallai_streaming: {
            mode: "prioritize_low_latency",
            language_code: "en",
          },
        },
      },
      ...(voiceExtras.recording_config ?? {}),
      ...(realtimeEndpoints ? { realtime_endpoints: realtimeEndpoints } : {}),
    },
    automatic_leave: {
      waiting_room_timeout: 600,
      noone_joined_timeout: 600,
    },
    metadata: { internal_bot_id: input.botId },
  };

  let lastError = "Recall scheduling failed";

  for (let attempt = 1; attempt <= RECALL_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${apiBase}/api/v1/bot/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.RECALL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = (await res.json()) as { id: string };
      return { externalBotId: json.id, provider: "recall" };
    }

    const text = await res.text();
    lastError = `Recall (${res.status}): ${text.slice(0, 400)}`;

    if (!RECALL_RETRY_STATUSES.has(res.status) || attempt === RECALL_MAX_ATTEMPTS) {
      break;
    }

    await sleep(attempt * 2000);
  }

  if (/401|403/.test(lastError)) {
    throw new Error(
      `Invalid RECALL_API_KEY or wrong RECALL_REGION. ${getRecallSetupHint()}`,
    );
  }

  if (/507/.test(lastError)) {
    throw new Error(
      "Recall has no bots available right now (507). Wait 1–2 minutes and try again, or schedule with join_at 10+ minutes ahead.",
    );
  }

  if (/does not have any active logins/i.test(lastError)) {
    throw new Error(
      "Google Login group has no active logins yet. Bot can join as a guest — remove RECALL_GOOGLE_LOGIN_ENABLED or leave it unset, restart dev server, and try again. " +
        getRecallGoogleLoginSetupHint(),
    );
  }

  if (/google.?login|login.?group|sso/i.test(lastError) && !googleMeet) {
    throw new Error(`${lastError} ${getRecallGoogleLoginSetupHint()}`);
  }

  throw new Error(lastError);
}

async function scheduleSimulatedBot(
  input: ScheduleBotInput,
): Promise<ScheduleBotResult> {
  const externalBotId = `sim_${input.botId}`;
  const delayMs = input.joinNow
    ? 0
    : Math.max(0, input.joinAt.getTime() - Date.now());
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const simulationSecret = getBotSimulationSecret();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (simulationSecret) {
    headers.Authorization = `Bearer ${simulationSecret}`;
  }

  void fetch(`${webhookBase}/api/webhooks/bot-simulation`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      internalBotId: input.botId,
      meetingTitle: input.meetingTitle,
      botName: input.botName,
      delayMs: input.joinNow ? 0 : Math.min(delayMs, 5000),
      joinNow: Boolean(input.joinNow),
    }),
  }).catch(() => {});

  return { externalBotId, provider: "simulation" };
}

export async function cancelRecallBot(externalBotId: string): Promise<void> {
  if (!hasRecall() || externalBotId.startsWith("sim_")) return;

  const res = await fetch(`${getRecallApiBase()}/api/v1/bot/${externalBotId}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Recall cancel failed: ${text}`);
  }
}

export function mapRecallStatus(code: string): BotStatus {
  switch (code) {
    case "joining_call":
    case "joining":
      return "joining";
    case "in_waiting_room":
    case "waiting_room":
      return "waiting_room";
    case "in_call_not_recording":
    case "joined":
      return "joined";
    case "in_call_recording":
    case "recording":
      return "recording";
    case "call_ended":
    case "meeting_ended":
      return "meeting_ended";
    case "done":
    case "completed":
      return "completed";
    case "fatal":
    case "failed":
      return "failed";
    default:
      return "joining";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
