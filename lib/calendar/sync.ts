import {
  fetchGoogleUpcomingEvents,
  refreshGoogleAccessToken,
} from "@/lib/calendar/google";
import {
  fetchMicrosoftUpcomingEvents,
  refreshMicrosoftAccessToken,
} from "@/lib/calendar/microsoft";
import {
  encryptedTokens,
  getPlainAccessToken,
  getPlainRefreshToken,
  type CalendarConnectionRow,
} from "@/lib/calendar/connection-tokens";
import { createServiceClient } from "@/lib/supabase/server";
import { meetingRowProvider } from "@/lib/meetings/provider";

export async function syncUserCalendars(userId: string, organizationId: string) {
  const supabase = createServiceClient();
  const { data: connections } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  if (!connections?.length) {
    return { imported: 0, message: "Connect Google or Microsoft Calendar first" };
  }

  let imported = 0;

  for (const raw of connections) {
    const connection = raw as CalendarConnectionRow;
    let accessToken = getPlainAccessToken(connection);
    const refreshToken = getPlainRefreshToken(connection);

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at) <= new Date()
    ) {
      if (connection.provider === "google" && refreshToken) {
        const refreshed = await refreshGoogleAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        const sealed = encryptedTokens({
          accessToken: refreshed.accessToken,
          refreshToken,
        });
        await supabase
          .from("calendar_connections")
          .update({
            access_token: sealed.access_token,
            token_expires_at: refreshed.expiresAt?.toISOString() ?? null,
          })
          .eq("id", connection.id);
      } else if (connection.provider === "microsoft" && refreshToken) {
        const refreshed = await refreshMicrosoftAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        const sealed = encryptedTokens({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? refreshToken,
        });
        await supabase
          .from("calendar_connections")
          .update({
            access_token: sealed.access_token,
            refresh_token: sealed.refresh_token,
            token_expires_at: refreshed.expiresAt?.toISOString() ?? null,
          })
          .eq("id", connection.id);
      }
    }

    const events =
      connection.provider === "google"
        ? await fetchGoogleUpcomingEvents(
            accessToken,
            connection.calendar_id ?? "primary",
          )
        : await fetchMicrosoftUpcomingEvents(accessToken);

    for (const event of events) {
      const { error } = await supabase.from("meetings").upsert(
        {
          user_id: userId,
          organization_id: organizationId,
          external_calendar_id: `${connection.provider}:${event.externalId}`,
          calendar_connection_id: connection.id,
          title: event.title,
          description: event.description,
          starts_at: event.startsAt,
          ends_at: event.endsAt,
          meeting_url: event.meetingUrl,
          platform: event.platform,
          provider: meetingRowProvider(event.meetingUrl ?? "", event.platform),
          organizer_email: event.organizerEmail,
          attendees: event.attendees,
          raw_event: event.raw,
        },
        { onConflict: "organization_id,external_calendar_id" },
      );
      if (!error) imported++;
    }
  }

  return { imported };
}
