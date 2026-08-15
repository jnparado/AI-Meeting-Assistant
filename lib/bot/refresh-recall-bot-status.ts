import { getRecallApiBase } from "@/lib/bot/recall-config";
import { mapRecallStatus } from "@/lib/bot/recall";
import { hasRecall } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import type { BotStatus } from "@/lib/types/database";

const ACTIVE_BOT_STATUSES = new Set<BotStatus>([
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

type BotRow = {
  id: string;
  external_bot_id: string | null;
  status: string;
};

export function isActiveBotStatus(status: string): boolean {
  return ACTIVE_BOT_STATUSES.has(status as BotStatus);
}

/** Pull latest status from Recall so stale DB rows do not block a new join. */
export async function refreshMeetingBotFromRecall(
  bot: BotRow,
): Promise<BotStatus | null> {
  if (!hasRecall() || !bot.external_bot_id?.trim()) {
    return bot.status as BotStatus;
  }

  try {
    const res = await fetch(
      `${getRecallApiBase()}/api/v1/bot/${bot.external_bot_id}/`,
      {
        headers: { Authorization: `Token ${process.env.RECALL_API_KEY}` },
      },
    );
    if (!res.ok) return bot.status as BotStatus;

    const payload = (await res.json()) as {
      status_changes?: { code?: string; sub_code?: string | null; message?: string | null }[];
    };
    const last = payload.status_changes?.[payload.status_changes.length - 1];
    if (!last?.code) return bot.status as BotStatus;

    const mapped = mapRecallStatus(last.code);
    const failureReason =
      last.sub_code ??
      (mapped === "failed" ? last.message ?? "Recall bot failed" : null);

    if (mapped !== bot.status || failureReason) {
      const supabase = createServiceClient();
      const patch: Record<string, unknown> = {
        status: mapped,
        updated_at: new Date().toISOString(),
      };
      if (failureReason) patch.failure_reason = failureReason;
      if (mapped === "completed") {
        patch.completed_at = new Date().toISOString();
      }
      await supabase.from("meeting_bots").update(patch).eq("id", bot.id);
    }

    return mapped;
  } catch (err) {
    console.error("refreshMeetingBotFromRecall:", err);
    return bot.status as BotStatus;
  }
}
