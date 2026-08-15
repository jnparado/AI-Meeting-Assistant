import { createMeetingBotForUser } from "@/lib/bot/create-meeting-bot";
import { resolveMeetingUrl } from "@/lib/calendar/resolve-meeting-url";
import { detectMeetingPlatform, meetingTitleForPlatform } from "@/lib/calendar/parse-meeting-url";
import { createAdhocMeetingRow } from "@/lib/meetings/create-adhoc-meeting";
import { findMeetingIdByUrl } from "@/lib/meetings/find-meeting-by-url";

export async function joinMeetingNow(
  userId: string,
  organizationId: string,
  meetingUrl: string,
  botName?: string,
  meetingId?: string,
) {
  let targetMeetingId = meetingId;

  if (!targetMeetingId) {
    const resolved = await resolveMeetingUrl(meetingUrl, {
      userId,
      organizationId,
    });
    if (!resolved.ok) {
      throw new Error(resolved.error);
    }

    const existingMeetingId = await findMeetingIdByUrl(
      organizationId,
      resolved.meetingUrl,
    );

    const now = new Date();
    const platform = detectMeetingPlatform(resolved.meetingUrl);
    const liveTitle = meetingTitleForPlatform(platform);

    targetMeetingId =
      existingMeetingId ??
      (await createAdhocMeetingRow({
        userId,
        organizationId,
        meetingUrl: resolved.meetingUrl,
        externalCalendarId: `adhoc:${now.getTime()}:${userId}`,
        title: liveTitle,
      }));

    return createMeetingBotForUser(userId, organizationId, {
      meetingId: targetMeetingId,
      meetingUrl: resolved.meetingUrl,
      botName,
      joinNow: true,
      knownMeeting: {
        id: targetMeetingId,
        title: liveTitle,
        starts_at: now.toISOString(),
      },
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
