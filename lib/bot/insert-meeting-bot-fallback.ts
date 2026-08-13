import type { createServiceClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceClient>;

function missingUserIdColumn(message: string): boolean {
  return /user_id.*meeting_bots|meeting_bots.*user_id|Could not find the 'user_id' column/i.test(
    message,
  );
}

function isRetryableBotInsertError(message: string): boolean {
  return (
    /schema cache/i.test(message) ||
    /invalid input value for enum/i.test(message) ||
    /column.*bot_name/i.test(message) ||
    /could not find the function/i.test(message) ||
    missingUserIdColumn(message)
  );
}

const JOIN_STATUSES = [
  "joining",
  "scheduled",
  "recording",
  "waiting_room",
  "waiting_for_host",
  "in_waiting_room",
] as const;

export async function ensureProfileForBot(
  supabase: Supabase,
  userId: string,
): Promise<void> {
  await supabase.from("profiles").upsert({ id: userId }, { onConflict: "id" });
}

function buildBotInsertPayloads(
  meetingId: string,
  userId: string,
  botName: string,
  joinAt: Date,
  statusCandidates: readonly string[],
  includeUserId: boolean,
): Record<string, unknown>[] {
  const payloads: Record<string, unknown>[] = [];
  const at = joinAt.toISOString();

  for (const status of statusCandidates) {
    if (includeUserId) {
      payloads.push({
        meeting_id: meetingId,
        user_id: userId,
        status,
        scheduled_for: at,
        bot_name: botName,
      });
      payloads.push({
        meeting_id: meetingId,
        user_id: userId,
        status,
        scheduled_for: at,
      });
    }
    payloads.push({
      meeting_id: meetingId,
      status,
      scheduled_for: at,
      bot_name: botName,
    });
    payloads.push({
      meeting_id: meetingId,
      status,
      scheduled_for: at,
    });
  }

  if (includeUserId) {
    payloads.push({
      meeting_id: meetingId,
      user_id: userId,
      scheduled_for: at,
      bot_name: botName,
    });
    payloads.push({
      meeting_id: meetingId,
      user_id: userId,
      scheduled_for: at,
    });
  }

  payloads.push({
    meeting_id: meetingId,
    scheduled_for: at,
    bot_name: botName,
  });
  payloads.push({ meeting_id: meetingId, scheduled_for: at });
  payloads.push({ meeting_id: meetingId });

  return payloads;
}

export async function insertMeetingBotWithFallbacks(
  supabase: Supabase,
  params: {
    meetingId: string;
    userId: string;
    botName: string;
    joinAt: Date;
    joinNow: boolean;
  },
): Promise<{ bot: Record<string, unknown> | null; lastError: string }> {
  const { meetingId, userId, botName, joinAt, joinNow } = params;
  let lastError = "";
  let skipUserId = false;

  await ensureProfileForBot(supabase, userId);

  const statusCandidates = joinNow
    ? JOIN_STATUSES
    : (["scheduled", "joining"] as const);

  for (const p_status of statusCandidates) {
    const { data: rpcBotId, error: rpcError } = await supabase.rpc(
      "meetmind_insert_meeting_bot",
      {
        p_meeting_id: meetingId,
        p_user_id: userId,
        p_bot_name: botName,
        p_status,
      },
    );

    if (!rpcError && rpcBotId) {
      return {
        bot: {
          id: rpcBotId,
          meeting_id: meetingId,
          user_id: userId,
          status: p_status,
          scheduled_for: joinAt.toISOString(),
          bot_name: botName,
        },
        lastError: "",
      };
    }
    if (rpcError?.message) {
      lastError = rpcError.message;
      if (missingUserIdColumn(rpcError.message)) {
        skipUserId = true;
        break;
      }
      if (!isRetryableBotInsertError(rpcError.message)) {
        throw new Error(rpcError.message);
      }
    }
  }

  const payloads = buildBotInsertPayloads(
    meetingId,
    userId,
    botName,
    joinAt,
    statusCandidates,
    !skipUserId,
  );

  for (const payload of payloads) {
    const { data: inserted, error: botError } = await supabase
      .from("meeting_bots")
      .insert(payload)
      .select("id, meeting_id, status, scheduled_for, bot_name")
      .single();

    if (!botError && inserted) {
      return {
        bot: {
          ...inserted,
          user_id: userId,
        } as Record<string, unknown>,
        lastError: "",
      };
    }
    if (botError) {
      lastError = botError.message;
      if (missingUserIdColumn(botError.message)) {
        skipUserId = true;
        continue;
      }
      if (!isRetryableBotInsertError(botError.message)) {
        throw new Error(botError.message);
      }
    }
  }

  if (skipUserId) {
    lastError =
      'meeting_bots.user_id column missing — run supabase/PATCH_meeting_bots.sql in Supabase SQL Editor';
  }

  return { bot: null, lastError };
}
