import { detectMeetingPlatform, extractMeetingUrl } from "@/lib/calendar/parse-meeting-url";
import type { MeetingPlatform } from "@/lib/types/database";

export type NormalizedCalendarEvent = {
  externalId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  meetingUrl: string | null;
  platform: MeetingPlatform;
  organizerEmail: string | null;
  attendees: { email?: string; name?: string }[];
  raw: unknown;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { uri?: string }[] };
  organizer?: { email?: string };
  attendees?: { email?: string; displayName?: string }[];
  location?: string;
};

export async function fetchGooglePrimaryCalendarId(
  accessToken: string,
): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Google primary calendar lookup failed: ${res.status}`);
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? "primary";
}

export async function fetchGoogleUpcomingEvents(
  accessToken: string,
  calendarId = "primary",
): Promise<NormalizedCalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
    maxResults: "50",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = (await res.json()) as { items?: GoogleEvent[] };
  return (data.items ?? []).map(normalizeGoogleEvent);
}

function normalizeGoogleEvent(event: GoogleEvent): NormalizedCalendarEvent {
  const meetingUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.uri)?.uri ??
    extractMeetingUrl(event.description ?? "") ??
    extractMeetingUrl(event.location ?? "");

  const startsAt =
    event.start?.dateTime ??
    (event.start?.date ? `${event.start.date}T00:00:00.000Z` : new Date().toISOString());
  const endsAt =
    event.end?.dateTime ??
    (event.end?.date ? `${event.end.date}T23:59:59.000Z` : startsAt);

  return {
    externalId: event.id,
    title: event.summary ?? "Untitled meeting",
    description: event.description ?? null,
    startsAt,
    endsAt,
    meetingUrl,
    platform: detectMeetingPlatform(meetingUrl),
    organizerEmail: event.organizer?.email ?? null,
    attendees: (event.attendees ?? []).map((a) => ({
      email: a.email,
      name: a.displayName,
    })),
    raw: event,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date | null;
}> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Google token");
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000)
    : null;

  return { accessToken: json.access_token, expiresAt };
}
