import type { SupabaseClient } from "@supabase/supabase-js";
import { findActiveBotForMeetingUrl } from "@/lib/bot/active-bot-for-url";
import {
  findNewestLiveRecallBotForMeetingUrl,
  mapRecallStatus,
} from "@/lib/bot/recall";
import {
  isActiveBotStatus,
  refreshMeetingBotFromRecall,
} from "@/lib/bot/refresh-recall-bot-status";
import { isBotControllable } from "@/lib/bot/bot-control-status";
import { hasRecall } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import type { BotStatus } from "@/lib/types/database";

export type ResolvedMeetingBot = {
  id: string;
  status: BotStatus;
  bot_name: string | null;
  external_bot_id: string | null;
  metadata: Record<string, unknown> | null;
  meeting_id: string;
  source: "meeting_id" | "meeting_url" | "recall_api";
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

function toResolved(
  row: BotRow,
  source: ResolvedMeetingBot["source"],
): ResolvedMeetingBot {
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

async function loadBotById(id: string): Promise<ResolvedMeetingBot | null> {
  const supabase = createServiceClient();
  const { data: fullBot } = await supabase
    .from("meeting_bots")
    .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
    .eq("id", id)
    .maybeSingle();
  return fullBot?.id ? toResolved(fullBot as BotRow, "meeting_url") : null;
}

async function loadBotByExternalId(
  externalBotId: string,
): Promise<ResolvedMeetingBot | null> {
  const supabase = createServiceClient();
  const { data: fullBot } = await supabase
    .from("meeting_bots")
    .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
    .eq("external_bot_id", externalBotId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return fullBot?.id ? toResolved(fullBot as BotRow, "recall_api") : null;
}

async function refreshResolved(
  bot: ResolvedMeetingBot,
): Promise<ResolvedMeetingBot | null> {
  if (!bot.external_bot_id) {
    return isBotControllable(bot.status) ? bot : null;
  }

  const refreshed = await refreshMeetingBotFromRecall({
    id: bot.id,
    external_bot_id: bot.external_bot_id,
    status: bot.status,
  });

  if (!refreshed || !isBotControllable(refreshed)) {
    return null;
  }

  return { ...bot, status: refreshed };
}

async function resolveFromRecallApi(
  meetingUrl: string,
): Promise<ResolvedMeetingBot | null> {
  if (!hasRecall()) return null;

  const recallBot = await findNewestLiveRecallBotForMeetingUrl(meetingUrl);
  if (!recallBot) return null;

  let row =
    (recallBot.internalBotId
      ? await loadBotById(recallBot.internalBotId)
      : null) ?? (await loadBotByExternalId(recallBot.id));

  if (!row) return null;

  const mapped = mapRecallStatus(recallBot.statusCode);
  const supabase = createServiceClient();
  if (row.status !== mapped || row.external_bot_id !== recallBot.id) {
    await supabase
      .from("meeting_bots")
      .update({
        status: mapped,
        external_bot_id: recallBot.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    row = {
      ...row,
      status: mapped,
      external_bot_id: recallBot.id,
    };
  }

  return refreshResolved(row);
}

/** Active bot for this meeting — prefers live Recall bots over stale DB rows. */
export async function resolveActiveMeetingBot(input: {
  supabase: SupabaseClient;
  meetingId: string;
  organizationId: string;
  userId: string;
  meetingUrl?: string | null;
}): Promise<ResolvedMeetingBot | null> {
  void input.supabase;

  const url = input.meetingUrl?.trim();

  if (url) {
    const fromRecall = await resolveFromRecallApi(url);
    if (fromRecall) return fromRecall;

    const byUrl = await findActiveBotForMeetingUrl(
      input.organizationId,
      input.userId,
      url,
    );
    if (byUrl?.id) {
      const loaded = await loadBotById(String(byUrl.id));
      if (loaded) {
        const refreshed = await refreshResolved(loaded);
        if (refreshed) return refreshed;
      }
    }
  }

  const service = createServiceClient();
  const { data: directBots } = await service
    .from("meeting_bots")
    .select("id, status, bot_name, external_bot_id, metadata, meeting_id")
    .eq("meeting_id", input.meetingId)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const directBot of directBots ?? []) {
    if (!directBot?.id) continue;
    const status = String(directBot.status);
    if (TERMINAL_STATUSES.has(status)) continue;

    const row = toResolved(directBot as BotRow, "meeting_id");
    const refreshed = await refreshResolved(row);
    if (refreshed) return refreshed;

    if (
      ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]) ||
      status === "processing"
    ) {
      return row;
    }
  }

  return null;
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
  const service = createServiceClient();

  const { data: meetingBots } = await service
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
      const loaded = await loadBotById(String(byUrl.id));
      if (loaded) {
        rows.set(loaded.id, {
          id: loaded.id,
          status: loaded.status,
          bot_name: loaded.bot_name,
          external_bot_id: loaded.external_bot_id,
          metadata: loaded.metadata,
          meeting_id: loaded.meeting_id,
        });
      }
    }
  }

  return [...rows.values()];
}
