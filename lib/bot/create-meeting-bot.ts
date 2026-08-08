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

  const meeting =
    input.knownMeeting ??
    (await loadMeeting(supabase, input.meetingId, organizationId));

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  if (!input.joinNow) {
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
  }

  let botName = input.botName?.trim() || DEFAULT_BOT_NAME;
  if (!input.botName?.trim()) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name, default_bot_name")
      .eq("id", organizationId)
      .single();
    botName =
      orgRow?.default_bot_name ||
      (orgRow?.name ? `${orgRow.name} AI Notetaker` : DEFAULT_BOT_NAME);
  }

  const joinAt = input.joinNow
    ? new Date()
    : input.joinAt
      ? new Date(input.joinAt)
      : defaultJoinAt(
          (meeting.starts_at as string | null | undefined) ?? new Date().toISOString(),
        );

  await supabase.rpc("meetmind_prepare_meeting_join", {
    p_meeting_id: meeting.id,
    p_meeting_url: joinUrl,
  });

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
    bot = {
      id: rpcBotId,
      meeting_id: meeting.id,
      user_id: userId,
      status: input.joinNow ? "joining" : "scheduled",
      scheduled_for: joinAt.toISOString(),
      bot_name: botName,
    };
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

    const { error: metaError } = await supabase
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

    if (metaError) {
      await supabase.rpc("meetmind_set_bot_schedule", {
        p_bot_id: botId,
        p_external_bot_id: scheduled.externalBotId,
        p_provider: scheduled.provider,
      });
    }

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

async function loadMeeting(
  supabase: ReturnType<typeof createServiceClient>,
  meetingId: string,
  organizationId: string,
): Promise<{ id: string; title: string; starts_at: string } | null> {
  const { data: meetingRow, error: meetingError } = await supabase
    .from("meetings")
    .select("id, title, starts_at, organization_id")
    .eq("id", meetingId)
    .eq("organization_id", organizationId)
    .single();

  if (meetingRow?.id) {
    return {
      id: meetingRow.id,
      title: (meetingRow.title as string) ?? "Meeting",
      starts_at: (meetingRow.starts_at as string) ?? new Date().toISOString(),
    };
  }

  if (meetingError?.message.includes("schema cache")) {
    const { data: minimal } = await supabase
      .from("meetings")
      .select("id")
      .eq("id", meetingId)
      .single();
    if (minimal?.id) {
      return {
        id: minimal.id as string,
        title: "Live Google Meet",
        starts_at: new Date().toISOString(),
      };
    }
  }

  return null;
}
