import type { GoogleEvent } from "@/lib/calendar/google-event-types";
import { extractMeetingUrl } from "@/lib/calendar/parse-meeting-url";

export function meetingUrlFromGoogleEvent(event: GoogleEvent): string | null {
  const fromConference = event.conferenceData?.entryPoints?.find(
    (e) => e.uri && e.entryPointType !== "phone",
  )?.uri;
  return (
    event.hangoutLink ??
    fromConference ??
    extractMeetingUrl(event.description ?? "") ??
    extractMeetingUrl(event.location ?? "")
  );
}

/** Decode `eid` from Google Calendar event URLs. */
export function parseGoogleCalendarEventLink(url: string): {
  eventId: string;
  calendarId: string;
} | null {
  try {
    const parsed = new URL(url);
    let eid = parsed.searchParams.get("eid");
    if (!eid) {
      const m = url.match(/[?&]eid=([^&]+)/i);
      eid = m?.[1] ? decodeURIComponent(m[1]) : null;
    }
    if (!eid) return null;

    const normalized = eid.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const spaceIdx = decoded.indexOf(" ");
    if (spaceIdx === -1) return null;

    return {
      eventId: decoded.slice(0, spaceIdx),
      calendarId: decoded.slice(spaceIdx + 1),
    };
  } catch {
    return null;
  }
}

export async function fetchGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleEvent | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return null;
  return (await res.json()) as GoogleEvent;
}
