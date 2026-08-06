import { getAppUrl, hasRecall } from "@/lib/env";
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
  const webhookUrl = `${getAppUrl()}/api/webhooks/recall`;
  const joinAt =
    input.joinAt.getTime() <= Date.now() ? null : input.joinAt.toISOString();

  const res = await fetch("https://api.recall.ai/api/v1/bot/", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: input.meetingUrl,
      bot_name: input.botName,
      ...(joinAt ? { join_at: joinAt } : {}),
      recording_config: {
        transcript: { provider: { meeting_captions: {} } },
      },
      automatic_leave: {
        waiting_room_timeout: 600,
        noone_joined_timeout: 600,
      },
      metadata: { internal_bot_id: input.botId },
      webhook_url: webhookUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recall scheduling failed: ${text}`);
  }

  const json = (await res.json()) as { id: string };
  return { externalBotId: json.id, provider: "recall" };
}

async function scheduleSimulatedBot(
  input: ScheduleBotInput,
): Promise<ScheduleBotResult> {
  const externalBotId = `sim_${input.botId}`;
  const delayMs = input.joinNow
    ? 0
    : Math.max(0, input.joinAt.getTime() - Date.now());
  const webhookBase = getAppUrl();

  void fetch(`${webhookBase}/api/webhooks/bot-simulation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export function mapRecallStatus(code: string): BotStatus {
  switch (code) {
    case "joining_call":
      return "joining";
    case "in_waiting_room":
      return "waiting_room";
    case "in_call_not_recording":
      return "joined";
    case "in_call_recording":
      return "recording";
    case "call_ended":
      return "meeting_ended";
    case "fatal":
      return "failed";
    default:
      return "joining";
  }
}
