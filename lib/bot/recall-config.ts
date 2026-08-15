import { getAppUrl } from "@/lib/env";

/**
 * Public HTTPS base URL Recall can reach (voice agent page + realtime webhooks).
 * Use Cloudflare quick tunnel / ngrok locally — NOT localhost. Falls back to NEXT_PUBLIC_APP_URL.
 */
export function getRecallPublicAppUrl(): string {
  const override = process.env.RECALL_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "");
  if (override) return override;
  return getAppUrl().replace(/\/$/, "");
}

export function isRecallPublicAppUrlReachable(): boolean {
  const url = getRecallPublicAppUrl();
  return (
    url.startsWith("https://") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  );
}
export function getRecallRegion(): string {
  return (
    process.env.RECALL_REGION?.trim() ||
    process.env.RECALLAI_REGION?.trim() ||
    "ap-northeast-1"
  );
}

export function getRecallApiBase(): string {
  const override = process.env.RECALL_API_BASE?.trim()?.replace(/\/$/, "");
  if (override) return override;
  return `https://${getRecallRegion()}.recall.ai`;
}

export function getRecallWebhookUrl(): string {
  return `${getRecallPublicAppUrl()}/api/webhooks/recall`;
}

export function getRecallGoogleLoginGroupId(): string | null {
  const id = process.env.RECALL_GOOGLE_LOGIN_GROUP_ID?.trim();
  return id || null;
}

/** True after at least one Google Login is registered in Recall (Workspace SSO). */
export function isRecallGoogleLoginEnabled(): boolean {
  const v = process.env.RECALL_GOOGLE_LOGIN_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Passed to Recall Create Bot so the bot signs into Google Meet (not as a guest).
 * Only sent when RECALL_GOOGLE_LOGIN_ENABLED=true — otherwise Recall 400s if the
 * group has no active logins yet.
 */
export function getRecallGoogleMeetBotConfig(): {
  google_login_group_id: string;
} | null {
  if (!isRecallGoogleLoginEnabled()) return null;
  const id = getRecallGoogleLoginGroupId();
  return id ? { google_login_group_id: id } : null;
}

export function getRecallGoogleLoginSetupHint(): string {
  return (
    "Google Login group exists but has no active logins yet — bot joins as guest until you finish SSO. " +
    "Steps: npm run recall:google-status → add login in Recall dashboard (Google Logins) or npm run recall:google-login-add → " +
    "set RECALL_GOOGLE_LOGIN_ENABLED=true. Docs: https://docs.recall.ai/docs/google-meet-login-getting-started"
  );
}

export function getRecallSetupHint(): string {
  return (
    "Add RECALL_API_KEY from https://www.recall.ai/ to .env.local (and Vercel). " +
    `Set RECALL_REGION if needed (default ap-northeast-1). ` +
    `In Recall → Webhooks, add: ${getRecallWebhookUrl()}. ` +
    getRecallGoogleLoginSetupHint()
  );
}
