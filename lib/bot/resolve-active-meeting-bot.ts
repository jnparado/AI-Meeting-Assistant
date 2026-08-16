import type { SupabaseClient } from "@supabase/supabase-js";
import { findActiveBotForMeetingUrl } from "@/lib/bot/active-bot-for-url";
import type { BotStatus } from "@/lib/types/database";

export type ResolvedMeetingBot = {
  id: string;
  status: BotStatus;
  bot_name: string | null;
  external_bot_id: string | null;
  metadata: Record<string, unknown> | null;
  meeting_id: string;
  source: "meeting_id" | "meeting_url";
};

type BotRow = {
  id: string;
  status: string;
  bot_name: string | null;
  external_bot_id: string | null;
  metadata: unknown;
  meeting_id: string;
};

const ACTIVE_STATUSES = [
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
] as const;

const TERMINAL_STATUSES = new Set([
  "cancelled",
  "failed",
  "completed",
  "meeting_ended",
]);

function toResolved(row: BotRow, source: ResolvedMeetingBot["source"]): ResolvedMeetingBot {
  return {
    id: String(row.id),
    status: String(row.status) as BotStatus,
    bot_name: (row.bot_name as string | null) ?? null,
    external_bot_id: (row.external_bot_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    meeting_id: String(row.meeting_id),
    source,
  };
}

async function loadBotById(
  supabase: SupabaseClient,
  id: string,
): Promise<ResolvedMeetingBot | null> {
  const { data: fullBot } = await supabase
    .from("meeting_bots")
    .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
    .eq("id", id)
    .maybeSingle();
  return fullBot?.id ? toResolved(fullBot as BotRow, "meeting_url") : null;
}

/** Active bot for this meeting — prefers a live bot on the same Meet URL over a stale cancelled row. */
export async function resolveActiveMeetingBot(input: {
  supabase: SupabaseClient;
  meetingId: string;
  organizationId: string;
  userId: string;
  meetingUrl?: string | null;
}): Promise<ResolvedMeetingBot | null> {
  const url = input.meetingUrl?.trim();
  if (url) {
    const byUrl = await findActiveBotForMeetingUrl(
      input.organizationId,
      input.userId,
      url,
    );
    if (byUrl?.id) {
      const loaded = await loadBotById(input.supabase, String(byUrl.id));
      if (loaded) return loaded;
    }
  }

  const { data: directBot } = await input.supabase
    .from("meeting_bots")
    .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
    .eq("meeting_id", input.meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!directBot?.id) return null;

  const status = String(directBot.status);
  if (TERMINAL_STATUSES.has(status)) return null;
  if (
    ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]) ||
    status === "processing"
  ) {
    return toResolved(directBot as BotRow, "meeting_id");
  }

  return toResolved(directBot as BotRow, "meeting_id");
}

/** All active bots for a meeting id and/or the same Meet URL. */
export async function listStoppableBotsForMeeting(input: {
  supabase: SupabaseClient;
  meetingId: string;
  organizationId: string;
  userId: string;
  meetingUrl?: string | null;
}): Promise<BotRow[]> {
  const rows = new Map<string, BotRow>();

  const { data: meetingBots } = await input.supabase
    .from("meeting_bots")
    .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
    .eq("meeting_id", input.meetingId)
    .in("status", [...ACTIVE_STATUSES]);

  for (const bot of meetingBots ?? []) {
    rows.set(String(bot.id), bot as BotRow);
  }

  const url = input.meetingUrl?.trim();
  if (url) {
    const byUrl = await findActiveBotForMeetingUrl(
      input.organizationId,
      input.userId,
      url,
    );
    if (byUrl) {
      const { data: fullBot } = await input.supabase
        .from("meeting_bots")
        .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
        .eq("id", byUrl.id)
        .maybeSingle();
      if (fullBot) {
        rows.set(String(fullBot.id), fullBot as BotRow);
      }
    }
  }

  return [...rows.values()];
}
