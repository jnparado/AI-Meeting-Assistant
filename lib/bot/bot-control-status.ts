import type { BotStatus } from "@/lib/types/database";

export const BOT_IN_CALL_STATUSES = new Set<BotStatus>([
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

export const BOT_CONTROLLABLE_STATUSES = new Set<BotStatus>([
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

export const BOT_TERMINAL_STATUSES = new Set<BotStatus>([
  "failed",
  "cancelled",
  "completed",
  "meeting_ended",
  "processing",
]);

export function isBotLive(status: BotStatus | null | undefined): boolean {
  return status ? BOT_IN_CALL_STATUSES.has(status) : false;
}

export function isBotControllable(
  status: BotStatus | null | undefined,
): boolean {
  return status ? BOT_CONTROLLABLE_STATUSES.has(status) : false;
}
