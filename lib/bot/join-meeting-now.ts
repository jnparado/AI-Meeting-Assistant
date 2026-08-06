import { createMeetingBotForUser } from "@/lib/bot/create-meeting-bot";
import { resolveMeetingUrl } from "@/lib/calendar/resolve-meeting-url";
import { createAdhocMeetingRow } from "@/lib/meetings/create-adhoc-meeting";

export async function joinMeetingNow(
  userId: string,
  organizationId: string,
  meetingUrl: string,
  botName?: string,
  meetingId?: string,
) {
  let targetMeetingId = meetingId;

  if (!targetMeetingId) {
    const resolved = await resolveMeetingUrl(meetingUrl);
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    const now = new Date();
    const externalId = `adhoc:${now.getTime()}:${userId}`;

    targetMeetingId = await createAdhocMeetingRow({
      userId,
      organizationId,
      meetingUrl: resolved.meetingUrl,
      externalCalendarId: externalId,
    });
  }

  if (!targetMeetingId) {
    throw new Error("Missing meeting id");
  }

  return createMeetingBotForUser(userId, organizationId, {
    meetingId: targetMeetingId,
    meetingUrl,
    botName,
    joinNow: true,
  });
}
