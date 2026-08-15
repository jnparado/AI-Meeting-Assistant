import { getRecallPublicAppUrl, getRecallWebhookUrl } from "@/lib/bot/recall-config";

function getRealtimeWebhookToken(): string | null {
  return (
    process.env.RECALL_REALTIME_WEBHOOK_TOKEN?.trim() ||
    process.env.RECALL_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

/** Per-bot realtime webhook URL (transcript.data during the call). Trailing slash required by Recall. */
export function getRecallRealtimeWebhookUrl(): string {
  const base = `${getRecallPublicAppUrl().replace(/\/$/, "")}/api/webhooks/recall/realtime/`;
  const token = getRealtimeWebhookToken();
  if (!token) return base;
  return `${base}?token=${encodeURIComponent(token)}`;
}

export function getRecallRealtimeEndpoints():
  | {
      type: "webhook";
      url: string;
      events: ["transcript.data", "transcript.partial_data"];
    }[]
  | undefined {
  if (!process.env.RECALL_API_KEY?.trim()) return undefined;
  return [
    {
      type: "webhook",
      url: getRecallRealtimeWebhookUrl(),
      events: ["transcript.data", "transcript.partial_data"],
    },
  ];
}

export function getRecallLiveTranscriptSetupHint(): string {
  return (
    `Live transcript webhooks: ${getRecallRealtimeWebhookUrl()} ` +
    `(status webhooks stay at ${getRecallWebhookUrl()}). ` +
    "Use a public HTTPS RECALL_PUBLIC_APP_URL so Recall can reach both endpoints."
  );
}
