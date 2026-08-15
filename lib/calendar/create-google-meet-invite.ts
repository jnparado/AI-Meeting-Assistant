import {
  createGoogleCalendarEventWithMeet,
  type CreatedGoogleCalendarEvent,
} from "@/lib/calendar/google-create-event";
import { refreshGoogleAccessToken } from "@/lib/calendar/google";
import {
  encryptedTokens,
  getPlainAccessToken,
  getPlainRefreshToken,
  type CalendarConnectionRow,
} from "@/lib/calendar/connection-tokens";
import { meetingRowProvider } from "@/lib/meetings/provider";
import { createServiceClient } from "@/lib/supabase/server";

export type CreateGoogleMeetInviteInput = {
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendeeEmails: string[];
  sendEmailInvites?: boolean;
};

export type CreateGoogleMeetInviteResult = {
  meetingId: string;
  meetingUrl: string;
  googleEventId: string;
  calendarHtmlLink: string | null;
  invitesSent: boolean;
  event: CreatedGoogleCalendarEvent;
};

async function getGoogleCalendarConnection(
  userId: string,
  organizationId: string,
): Promise<CalendarConnectionRow> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(
      "Connect Google Calendar first, then schedule a Meet invitation.",
    );
  }

  return data as CalendarConnectionRow;
}

async function ensureGoogleAccessToken(
  connection: CalendarConnectionRow,
): Promise<string> {
  let accessToken = getPlainAccessToken(connection);
  const refreshToken = getPlainRefreshToken(connection);

  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) <= new Date()
  ) {
    if (!refreshToken) {
      throw new Error(
        "Google Calendar access expired. Reconnect Google Calendar and try again.",
      );
    }

    const refreshed = await refreshGoogleAccessToken(refreshToken);
    accessToken = refreshed.accessToken;

    const sealed = encryptedTokens({
      accessToken: refreshed.accessToken,
      refreshToken,
    });
    await createServiceClient()
      .from("calendar_connections")
      .update({
        access_token: sealed.access_token,
        token_expires_at: refreshed.expiresAt?.toISOString() ?? null,
      })
      .eq("id", connection.id);
  }

  return accessToken;
}

export async function createGoogleMeetInvite(
  userId: string,
  organizationId: string,
  input: CreateGoogleMeetInviteInput,
): Promise<CreateGoogleMeetInviteResult> {
  const connection = await getGoogleCalendarConnection(userId, organizationId);
  const accessToken = await ensureGoogleAccessToken(connection);

  const event = await createGoogleCalendarEventWithMeet({
    accessToken,
    calendarId: connection.calendar_id ?? "primary",
    title: input.title,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone,
    attendeeEmails: input.attendeeEmails,
    sendEmailInvites: input.sendEmailInvites,
  });

  const supabase = createServiceClient();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        external_calendar_id: `google:${event.id}`,
        calendar_connection_id: connection.id,
        title: event.title,
        description: event.description,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        meeting_url: event.meetingUrl,
        platform: "google_meet",
        provider: meetingRowProvider(event.meetingUrl, "google_meet"),
        organizer_email: event.organizerEmail,
        attendees: event.attendees,
        raw_event: event.raw,
      },
      { onConflict: "organization_id,external_calendar_id" },
    )
    .select("id")
    .single();

  if (error || !meeting) {
    throw new Error(error?.message ?? "Could not save meeting to dashboard.");
  }

  return {
    meetingId: meeting.id,
    meetingUrl: event.meetingUrl,
    googleEventId: event.id,
    calendarHtmlLink: event.htmlLink,
    invitesSent: input.sendEmailInvites !== false && input.attendeeEmails.length > 0,
    event,
  };
}
