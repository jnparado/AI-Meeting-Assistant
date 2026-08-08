import { detectMeetingPlatform, extractMeetingUrl } from "@/lib/calendar/parse-meeting-url";
import type { NormalizedCalendarEvent } from "@/lib/calendar/google";

type GraphEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  onlineMeeting?: { joinUrl?: string };
  location?: { displayName?: string };
  organizer?: { emailAddress?: { address?: string; name?: string } };
  attendees?: {
    emailAddress?: { address?: string; name?: string };
  }[];
};

export async function fetchMicrosoftUpcomingEvents(
  accessToken: string,
): Promise<NormalizedCalendarEvent[]> {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$orderby=start/dateTime&$top=50`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Microsoft Graph error: ${res.status}`);
  }

  const data = (await res.json()) as { value?: GraphEvent[] };
  return (data.value ?? []).map(normalizeMicrosoftEvent);
}

function normalizeMicrosoftEvent(event: GraphEvent): NormalizedCalendarEvent {
  const meetingUrl =
    event.onlineMeeting?.joinUrl ??
    extractMeetingUrl(event.bodyPreview ?? "") ??
    extractMeetingUrl(event.location?.displayName ?? "");

  const startsAt = event.start?.dateTime
    ? new Date(event.start.dateTime + "Z").toISOString()
    : new Date().toISOString();
  const endsAt = event.end?.dateTime
    ? new Date(event.end.dateTime + "Z").toISOString()
    : startsAt;

  return {
    externalId: event.id,
    title: event.subject ?? "Untitled meeting",
    description: event.bodyPreview ?? null,
    startsAt,
    endsAt,
    meetingUrl,
    platform: detectMeetingPlatform(meetingUrl),
    organizerEmail: event.organizer?.emailAddress?.address ?? null,
    attendees: (event.attendees ?? []).map((a) => ({
      email: a.emailAddress?.address,
      name: a.emailAddress?.name,
    })),
    raw: event,
  };
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}> {
  const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "offline_access Calendars.ReadWrite User.Read",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!res.ok) {
    throw new Error("Failed to refresh Microsoft token");
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000)
    : null;

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
  };
}
