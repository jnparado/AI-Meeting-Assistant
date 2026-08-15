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
import { detectMeetingPlatform } from "@/lib/calendar/parse-meeting-url";
import { prepareMeetingForJoin } from "@/lib/meetings/insert-meeting-fallback";
import { insertMeetingBotWithFallbacks } from "@/lib/bot/insert-meeting-bot-fallback";
import { findActiveBotForMeetingUrl } from "@/lib/bot/active-bot-for-url";
import { getDefaultBotName } from "@/lib/bot/default-bot-name";
import {
  isActiveBotStatus,
  refreshMeetingBotFromRecall,
} from "@/lib/bot/refresh-recall-bot-status";

const JOIN_LEAD_MINUTES = 1;

export async function createMeetingBotForUser(
  userId: string,
  organizationId: string,
  input: CreateMeetingBotInput,
) {
  const resolved = await resolveMeetingUrl(input.meetingUrl, {
    userId,
    organizationId,
  });
  if (!resolved.ok) {
    throw new Error(resolved.error);
  }

  const urlCheck = validateMeetingUrl(resolved.meetingUrl);
  if (!urlCheck.ok) {
    throw new Error(urlCheck.error);
  }

  const joinUrl = resolved.meetingUrl;
  const platform = detectMeetingPlatform(joinUrl);

  await assertSubscriptionAndCredits(organizationId, { autoFix: true });

  const supabase = createServiceClient();

  const meeting =
    input.knownMeeting ??
    (await loadMeeting(supabase, input.meetingId, organizationId));

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  let activeForUrl = await findActiveBotForMeetingUrl(
    organizationId,
    userId,
    joinUrl,
  );

  if (activeForUrl?.external_bot_id) {
    const liveStatus = await refreshMeetingBotFromRecall({
      id: activeForUrl.id,
      external_bot_id: activeForUrl.external_bot_id,
      status: activeForUrl.status,
    });
    if (liveStatus && !isActiveBotStatus(liveStatus)) {
      activeForUrl = null;
    } else if (liveStatus) {
      activeForUrl = { ...activeForUrl, status: liveStatus };
    }
  }

  if (activeForUrl) {
    if (input.joinNow) {
      return {
        bot: activeForUrl,
        joinAt:
          (activeForUrl.scheduled_for as string | null) ??
          new Date().toISOString(),
        botName: (activeForUrl.bot_name as string) ?? getDefaultBotName(),
        resolvedMeetingUrl: joinUrl,
        alreadyActive: true,
      };
    }

    if (activeForUrl.meeting_id === meeting.id) {
      throw new Error("An AI assistant is already scheduled for this meeting");
    }

    throw new Error(
      "An AI assistant is already active for this meeting link. Open it from your meetings dashboard or remove the bot first.",
    );
  }

  let botName = input.botName?.trim() || getDefaultBotName();
  if (!input.botName?.trim()) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name, default_bot_name")
      .eq("id", organizationId)
      .single();
    botName =
      orgRow?.default_bot_name ||
      (orgRow?.name ? `${orgRow.name} AI Notetaker` : getDefaultBotName());
  }

  const joinAt = input.joinNow
    ? new Date()
    : input.joinAt
      ? new Date(input.joinAt)
      : defaultJoinAt(
          (meeting.starts_at as string | null | undefined) ?? new Date().toISOString(),
        );

  await prepareMeetingForJoin(supabase, meeting.id, joinUrl, platform);

  const { bot: insertedBot, lastError: botInsertError } =
    await insertMeetingBotWithFallbacks(supabase, {
      meetingId: meeting.id,
      userId,
      botName,
      joinAt,
      joinNow: Boolean(input.joinNow),
    });

  const bot = insertedBot;

  if (!bot) {
    const detail = botInsertError ? ` (${botInsertError.slice(0, 160)})` : "";
    throw new Error(
      `Failed to create bot — run npm run db:fix or RUN_IN_SQL_EDITOR.sql${detail}`,
    );
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
      alreadyActive: false,
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
