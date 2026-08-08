function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
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
