import type { CalendarProvider, MeetingPlatform } from "@/lib/types/database";
import { detectMeetingPlatform } from "@/lib/calendar/parse-meeting-url";

/** Calendar OAuth source (calendar_connections). */
export function calendarProviderForMeetingUrl(url: string): CalendarProvider {
  const lower = url.toLowerCase();
  if (
    lower.includes("teams.microsoft.com") ||
    lower.includes("teams.live.com") ||
    lower.includes("office.com/meet")
  ) {
    return "microsoft";
  }
  return "google";
}

export function calendarProviderForPlatform(
  platform: MeetingPlatform,
): CalendarProvider {
  if (platform === "teams") return "microsoft";
  return "google";
}

/**
 * Value for meetings.provider — many Supabase projects use meeting_provider
 * (google_meet | zoom | teams) not calendar_provider (google | microsoft).
 */
export function meetingRowProvider(
  meetingUrl: string,
  platform?: MeetingPlatform,
): MeetingPlatform {
  return platform ?? detectMeetingPlatform(meetingUrl);
}
