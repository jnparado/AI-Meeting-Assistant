import { randomUUID } from "crypto";

export type CreateGoogleCalendarEventInput = {
  accessToken: string;
  calendarId?: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendeeEmails: string[];
  sendEmailInvites?: boolean;
};

export type CreatedGoogleCalendarEvent = {
  id: string;
  htmlLink: string | null;
  hangoutLink: string | null;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
  title: string;
  description: string | null;
  organizerEmail: string | null;
  attendees: { email?: string; name?: string }[];
  raw: unknown;
};

type GoogleEventResponse = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: { email?: string; displayName?: string }[];
  conferenceData?: { entryPoints?: { uri?: string }[] };
};

function extractMeetingUrl(event: GoogleEventResponse): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri ??
    null
  );
}

export async function createGoogleCalendarEventWithMeet(
  input: CreateGoogleCalendarEventInput,
): Promise<CreatedGoogleCalendarEvent> {
  const calendarId = encodeURIComponent(input.calendarId ?? "primary");
  const sendUpdates = input.sendEmailInvites === false ? "none" : "all";
  const params = new URLSearchParams({
    conferenceDataVersion: "1",
    sendUpdates,
  });

  const body = {
    summary: input.title,
    description: input.description?.trim() || undefined,
    start: {
      dateTime: input.startsAt,
      timeZone: input.timeZone,
    },
    end: {
      dateTime: input.endsAt,
      timeZone: input.timeZone,
    },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Google Calendar create failed (${res.status}): ${text.slice(0, 400)}`,
    );
  }

  const event = JSON.parse(text) as GoogleEventResponse;
  const meetingUrl = extractMeetingUrl(event);
  if (!meetingUrl) {
    throw new Error(
      "Google Calendar event was created but no Google Meet link was returned.",
    );
  }

  return {
    id: event.id,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
    meetingUrl,
    startsAt:
      event.start?.dateTime ??
      (event.start?.date ? `${event.start.date}T00:00:00.000Z` : input.startsAt),
    endsAt:
      event.end?.dateTime ??
      (event.end?.date ? `${event.end.date}T23:59:59.000Z` : input.endsAt),
    title: event.summary ?? input.title,
    description: event.description ?? input.description ?? null,
    organizerEmail: event.organizer?.email ?? null,
    attendees: (event.attendees ?? []).map((attendee) => ({
      email: attendee.email,
      name: attendee.displayName,
    })),
    raw: event,
  };
}
