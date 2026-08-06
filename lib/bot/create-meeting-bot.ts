import { createServiceClient } from "@/lib/supabase/server";
import { scheduleMeetingBot } from "@/lib/bot/recall";
import {
  assertSubscriptionAndCredits,
  consumeMeetingCredit,
  SubscriptionError,
} from "@/lib/bot/credits";
import {
  validateMeetingUrl,
  type CreateMeetingBotInput,
} from "@/lib/bot/validate-meeting-url";
import { resolveMeetingUrl } from "@/lib/calendar/resolve-meeting-url";

const DEFAULT_BOT_NAME = "ServiceFlow AI Notetaker";
const JOIN_LEAD_MINUTES = 1;

export async function createMeetingBotForUser(
  userId: string,
  organizationId: string,
  input: CreateMeetingBotInput,
) {
  const resolved = await resolveMeetingUrl(input.meetingUrl);
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  const urlCheck = validateMeetingUrl(resolved.meetingUrl);
  if (!urlCheck.ok) {
    throw new Error(urlCheck.error);
  }

  const joinUrl = resolved.meetingUrl;

  await assertSubscriptionAndCredits(organizationId, { autoFix: true });

  const supabase = createServiceClient();

  let meeting: {
    id: string;
    title?: string | null;
    starts_at?: string | null;
    organization_id?: string;
  } | null = null;

  const { data: meetingRow, error: meetingError } = await supabase
    .from("meetings")
    .select("id, title, starts_at, organization_id")
    .eq("id", input.meetingId)
    .eq("organization_id", organizationId)
    .single();

  if (meetingRow) {
    meeting = meetingRow;
  } else if (meetingError?.message.includes("schema cache")) {
    const { data: minimal } = await supabase
      .from("meetings")
      .select("id")
      .eq("id", input.meetingId)
      .single();
    if (minimal) {
      meeting = {
        id: minimal.id as string,
        title: "Live Google Meet",
        starts_at: new Date().toISOString(),
      };
    }
  }

  if (!meeting) {
    throw new Error(meetingError?.message ?? "Meeting not found");
  }

  const { data: existingBots } = await supabase
    .from("meeting_bots")
    .select("id, status")
    .eq("meeting_id", meeting.id);

  const active = (existingBots ?? []).find((b) =>
    !["completed", "failed", "cancelled"].includes(b.status as string),
  );

  if (active) {
    throw new Error("An AI assistant is already scheduled for this meeting");
  }

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name, default_bot_name")
    .eq("id", organizationId)
    .single();

  const botName =
    input.botName?.trim() ||
    orgRow?.default_bot_name ||
    (orgRow?.name ? `${orgRow.name} AI Notetaker` : DEFAULT_BOT_NAME);

  const joinAt = input.joinNow
    ? new Date()
    : input.joinAt
      ? new Date(input.joinAt)
      : defaultJoinAt(
          (meeting.starts_at as string | null | undefined) ?? new Date().toISOString(),
        );

  await supabase
    .from("meetings")
    .update({
      meeting_url: joinUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meeting.id);

  void supabase
    .from("meetings")
    .update({
      platform: urlCheck.platform,
      ai_assistant_enabled: true,
    })
    .eq("id", meeting.id);

  let bot: Record<string, unknown> | null = null;

  const { data: rpcBotId, error: rpcBotError } = await supabase.rpc(
    "meetmind_insert_meeting_bot",
    {
      p_meeting_id: meeting.id,
      p_user_id: userId,
      p_bot_name: botName,
      p_status: input.joinNow ? "joining" : "scheduled",
    },
  );

  if (!rpcBotError && rpcBotId) {
    const { data: rpcRow } = await supabase
      .from("meeting_bots")
      .select("id, meeting_id, user_id, status, scheduled_for, bot_name")
      .eq("id", rpcBotId)
      .maybeSingle();
    if (rpcRow) bot = rpcRow as Record<string, unknown>;
  }

  if (!bot) {
    const { data: inserted, error: botError } = await supabase
      .from("meeting_bots")
      .insert({
        meeting_id: meeting.id,
        user_id: userId,
        status: input.joinNow ? "joining" : "scheduled",
        scheduled_for: joinAt.toISOString(),
        bot_name: botName,
      })
      .select("id, meeting_id, user_id, status, scheduled_for, bot_name")
      .single();

    if (botError || !inserted) {
      throw new Error(botError?.message ?? "Failed to create bot");
    }
    bot = inserted as Record<string, unknown>;
  }

  const botId = bot.id as string;

  try {
    const scheduled = await scheduleMeetingBot({
      meetingUrl: joinUrl,
      meetingTitle: meeting.title as string,
      joinAt,
      botId: botId,
      botName,
      joinNow: Boolean(input.joinNow),
    });

    await supabase
      .from("meeting_bots")
      .update({
        external_bot_id: scheduled.externalBotId,
        metadata: {
          provider: scheduled.provider,
          join_at: joinAt.toISOString(),
          ...(resolved.resolvedFrom
            ? { source_calendar_url: resolved.resolvedFrom }
            : {}),
        },
      })
      .eq("id", botId);

    await consumeMeetingCredit(organizationId);

    return {
      bot,
      joinAt: joinAt.toISOString(),
      botName,
      resolvedMeetingUrl: joinUrl,
    };
  } catch (err) {
    await supabase
      .from("meeting_bots")
      .update({
        status: "failed",
        failure_reason: err instanceof Error ? err.message : "Provider error",
      })
      .eq("id", botId);

    await supabase
      .from("meetings")
      .update({ ai_assistant_enabled: false })
      .eq("id", meeting.id);

    throw err;
  }
}

function defaultJoinAt(startsAt: string): Date {
  const joinAt = new Date(startsAt);
  joinAt.setMinutes(joinAt.getMinutes() - JOIN_LEAD_MINUTES);
  if (joinAt.getTime() <= Date.now()) {
    return new Date();
  }
  return joinAt;
}

export { SubscriptionError };
