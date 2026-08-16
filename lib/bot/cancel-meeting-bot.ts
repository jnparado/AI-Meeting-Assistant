import { createServiceClient } from "@/lib/supabase/server";
import {
  cancelRecallBot,
  removeAllRecallBotsForMeetingUrl,
} from "@/lib/bot/recall";
import { listStoppableBotsForMeeting } from "@/lib/bot/resolve-active-meeting-bot";

export type CancelMeetingBotResult = {
  removedFromRecall: number;
  cancelledInDb: number;
};

export async function cancelMeetingBotForUser(
  userId: string,
  organizationId: string,
  meetingId: string,
  meetingUrlOverride?: string | null,
): Promise<CancelMeetingBotResult> {
  const supabase = createServiceClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, meeting_url")
    .eq("id", meetingId)
    .eq("organization_id", organizationId)
    .single();

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const meetingUrl =
    meetingUrlOverride?.trim() ||
    (meeting.meeting_url as string | null)?.trim() ||
    null;

  const cancelledExternalIds = new Set<string>();
  let removedFromRecall = 0;

  if (meetingUrl) {
    try {
      const result = await removeAllRecallBotsForMeetingUrl(meetingUrl);
      removedFromRecall = result.removed;
      for (const id of result.removedIds) {
        cancelledExternalIds.add(id);
      }
    } catch (err) {
      console.error("removeAllRecallBotsForMeetingUrl failed:", err);
    }
  }

  const stoppable = await listStoppableBotsForMeeting({
    supabase,
    meetingId,
    organizationId,
    userId,
    meetingUrl,
  });

  for (const bot of stoppable) {
    const externalId = bot.external_bot_id?.trim();
    if (!externalId || cancelledExternalIds.has(externalId)) continue;
    cancelledExternalIds.add(externalId);
    try {
      await cancelRecallBot(externalId);
      removedFromRecall += 1;
    } catch (err) {
      console.error("cancelRecallBot failed:", err);
    }
  }

  const { data: recentBots } = await supabase
    .from("meeting_bots")
    .select("id, external_bot_id, status, meeting_id")
    .eq("meeting_id", meetingId)
    .not("external_bot_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  for (const bot of recentBots ?? []) {
    const externalId = bot.external_bot_id?.trim();
    if (!externalId || cancelledExternalIds.has(externalId)) continue;
    cancelledExternalIds.add(externalId);
    try {
      await cancelRecallBot(externalId);
      removedFromRecall += 1;
    } catch (err) {
      console.error("cancelRecallBot (recent) failed:", err);
    }
  }

  const meetingIds = new Set<string>([meetingId]);
  for (const bot of stoppable) {
    meetingIds.add(String(bot.meeting_id));
  }

  let cancelledInDb = 0;

  for (const id of meetingIds) {
    const { data: updated } = await supabase
      .from("meeting_bots")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("meeting_id", id)
      .neq("status", "cancelled")
      .select("id");
    cancelledInDb += updated?.length ?? 0;
  }

  for (const bot of recentBots ?? []) {
    const { data: updated } = await supabase
      .from("meeting_bots")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", bot.id)
      .neq("status", "cancelled")
      .select("id");
    cancelledInDb += updated?.length ?? 0;
  }

  await supabase
    .from("meetings")
    .update({ ai_assistant_enabled: false })
    .eq("id", meetingId);

  return { removedFromRecall, cancelledInDb };
}
