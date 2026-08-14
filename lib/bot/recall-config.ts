import { getAppUrl } from "@/lib/env";

/** Recall API region (see Recall dashboard → API keys). */
export function getRecallRegion(): string {
  return (
    process.env.RECALL_REGION?.trim() ||
    process.env.RECALLAI_REGION?.trim() ||
    "us-west-2"
  );
}

export function getRecallApiBase(): string {
  const override = process.env.RECALL_API_BASE?.trim()?.replace(/\/$/, "");
  if (override) return override;
  return `https://${getRecallRegion()}.recall.ai`;
}

export function getRecallWebhookUrl(): string {
  return `${getAppUrl().replace(/\/$/, "")}/api/webhooks/recall`;
}

export function getRecallSetupHint(): string {
  return (
    "Add RECALL_API_KEY from https://www.recall.ai/ to .env.local (and Vercel). " +
    `Set RECALL_REGION if needed (default us-west-2). ` +
    `In Recall → Webhooks, add: ${getRecallWebhookUrl()}`
  );
}
