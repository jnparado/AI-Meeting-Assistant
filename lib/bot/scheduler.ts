import { createServiceClient } from "@/lib/supabase/server";
import { scheduleMeetingBot } from "@/lib/bot/recall";
import { cancelMeetingBotForUser } from "@/lib/bot/cancel-meeting-bot";
import {
  createMeetingBotForUser,
  type SubscriptionError,
} from "@/lib/bot/create-meeting-bot";
import type { CreateMeetingBotInput } from "@/lib/bot/validate-meeting-url";

export async function enableAssistantForMeeting(
  meetingId: string,
  userId: string,
  organizationId: string,
) {
  const supabase = createServiceClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, meeting_url, starts_at")
    .eq("id", meetingId)
    .eq("organization_id", organizationId)
    .single();

  if (!meeting?.meeting_url) {
    throw new Error("This event has no video conference link");
  }

  const input: CreateMeetingBotInput = {
    meetingId,
    meetingUrl: meeting.meeting_url,
  };

  const result = await createMeetingBotForUser(userId, organizationId, input);
  return result.bot;
}

export { cancelMeetingBotForUser, createMeetingBotForUser, scheduleMeetingBot };
