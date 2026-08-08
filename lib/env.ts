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
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Protects internal bot simulation webhook (defaults to CRON_SECRET in dev). */
export function getBotSimulationSecret(): string | null {
  return (
    process.env.BOT_SIMULATION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}
