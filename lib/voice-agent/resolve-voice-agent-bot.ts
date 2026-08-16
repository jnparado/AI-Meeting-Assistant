import { createServiceClient } from "@/lib/supabase/server";

const ACTIVE_BOT_STATUSES = [
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
] as const;

/** Resolve internal meeting_bots.id for the voice-agent page (Speak now queue). */
export async function resolveVoiceAgentBotId(input: {
  botId?: string | null;
  token?: string | null;
  botName?: string | null;
}): Promise<string | null> {
  const explicit = input.botId?.trim();
  if (explicit) return explicit;

  const supabase = createServiceClient();
  const token = input.token?.trim();
  const botName = input.botName?.trim().toLowerCase();

  if (token) {
    const { data: byUrl } = await supabase
      .from("meeting_bots")
      .select("id, metadata, bot_name, status, created_at")
      .in("status", [...ACTIVE_BOT_STATUSES])
      .order("created_at", { ascending: false })
      .limit(30);

    for (const row of byUrl ?? []) {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const voiceUrl = metadata.voice_agent_url;
      if (typeof voiceUrl === "string" && voiceUrl.includes(token)) {
        return String(row.id);
      }
    }
  }

  if (botName) {
    const { data: byName } = await supabase
      .from("meeting_bots")
      .select("id, bot_name, status, created_at")
      .in("status", [...ACTIVE_BOT_STATUSES])
      .order("created_at", { ascending: false })
      .limit(20);

    for (const row of byName ?? []) {
      const name = String(row.bot_name ?? "")
        .trim()
        .toLowerCase();
      if (name === botName) {
        return String(row.id);
      }
    }
  }

  return null;
}
