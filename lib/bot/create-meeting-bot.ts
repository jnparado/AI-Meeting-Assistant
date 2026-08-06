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

const DEFAULT_BOT_NAME = "ServiceFlow AI Notetaker";
const JOIN_LEAD_MINUTES = 1;

export async function createMeetingBotForUser(
  userId: string,
  organizationId: string,
  input: CreateMeetingBotInput,
) {
  const urlCheck = validateMeetingUrl(input.meetingUrl);
  if (!urlCheck.ok) {
    throw new Error(urlCheck.error);
  }

  await assertSubscriptionAndCredits(organizationId);

  const supabase = createServiceClient();

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", input.meetingId)
    .eq("organization_id", organizationId)
    .single();

  if (meetingError || !meeting) {
    throw new Error("Meeting not found");
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

  const joinAt = input.joinAt
    ? new Date(input.joinAt)
    : defaultJoinAt(meeting.starts_at as string);

  await supabase
    .from("meetings")
    .update({
      meeting_url: input.meetingUrl,
      platform: urlCheck.platform,
      ai_assistant_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meeting.id);

  const { data: bot, error: botError } = await supabase
    .from("meeting_bots")
    .insert({
      meeting_id: meeting.id,
      user_id: userId,
      status: "scheduled",
      scheduled_for: joinAt.toISOString(),
      bot_name: botName,
    })
    .select("*")
    .single();

  if (botError || !bot) {
    throw new Error(botError?.message ?? "Failed to create bot");
  }

  try {
    const scheduled = await scheduleMeetingBot({
      meetingUrl: input.meetingUrl,
      meetingTitle: meeting.title as string,
      joinAt,
      botId: bot.id,
      botName,
    });

    await supabase
      .from("meeting_bots")
      .update({
        external_bot_id: scheduled.externalBotId,
        metadata: {
          provider: scheduled.provider,
          join_at: joinAt.toISOString(),
        },
      })
      .eq("id", bot.id);

    await consumeMeetingCredit(organizationId);

    return { bot, joinAt: joinAt.toISOString(), botName };
  } catch (err) {
    await supabase
      .from("meeting_bots")
      .update({
        status: "failed",
        failure_reason: err instanceof Error ? err.message : "Provider error",
      })
      .eq("id", bot.id);

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
