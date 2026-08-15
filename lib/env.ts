function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getAppUrl(): string {
  const normalized = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (process.env.VERCEL === "1") {
    if (normalized) return normalized;
    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim().replace(
      /^https?:\/\//,
      "",
    );
    if (prodHost) return `https://${prodHost}`;
    const vercelHost = process.env.VERCEL_URL?.trim();
    if (vercelHost) return `https://${vercelHost}`;
  }

  if (
    normalized?.startsWith("http://localhost") ||
    normalized?.startsWith("http://127.0.0.1")
  ) {
    return normalized;
  }

  return normalized ?? "http://localhost:3000";
}

export function getSupabasePublic() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function hasRecall(): boolean {
  return Boolean(process.env.RECALL_API_KEY);
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function hasXai(): boolean {
  return Boolean(getXaiApiKey());
}

/** xAI or OpenAI — used for voice agent + meeting Q&A. */
export function hasLlm(): boolean {
  return hasXai() || hasOpenAI();
}

export function getXaiApiKey(): string | null {
  return (
    process.env.XAI_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    null
  );
}

export function getGrokBaseUrl(): string {
  return (
    process.env.GROK_BASE_URL?.trim()?.replace(/\/$/, "") ||
    "https://api.x.ai/v1"
  );
}

export type VoiceAgentProvider = "xai" | "openai";

export function getVoiceAgentProvider(): VoiceAgentProvider {
  const override = process.env.RECALL_VOICE_AGENT_PROVIDER?.trim().toLowerCase();
  if (override === "xai" || override === "openai") return override;
  if (hasXai()) return "xai";
  return "openai";
}

export function getVoiceAgentApiKey(): string | null {
  const provider = getVoiceAgentProvider();
  if (provider === "xai") return getXaiApiKey();
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function getVoiceAgentApiBase(): string {
  if (getVoiceAgentProvider() === "xai") return getGrokBaseUrl();
  return "https://api.openai.com/v1";
}

export function hasVoiceAgentLlm(): boolean {
  return Boolean(getVoiceAgentApiKey());
}

export function getLlmApiKey(): string | null {
  if (hasXai()) return getXaiApiKey();
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function getLlmBaseUrl(): string {
  if (hasXai()) return getGrokBaseUrl();
  return "https://api.openai.com/v1";
}

export function getLlmChatModel(): string {
  if (hasXai()) {
    return (
      process.env.GROK_CHAT_MODEL?.trim() ||
      process.env.XAI_CHAT_MODEL?.trim() ||
      "grok-3-mini-fast"
    );
  }
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}

/** Protects internal bot simulation webhook (defaults to CRON_SECRET in dev). */
export function getBotSimulationSecret(): string | null {
  return (
    process.env.BOT_SIMULATION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}
