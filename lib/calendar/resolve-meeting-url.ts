import { extractMeetingUrl, detectMeetingPlatform } from "@/lib/calendar/parse-meeting-url";
import {
  fetchGoogleCalendarEvent,
  meetingUrlFromGoogleEvent,
  parseGoogleCalendarEventLink,
} from "@/lib/calendar/google-event-resolve";
import {
  encryptedTokens,
  getPlainAccessToken,
  getPlainRefreshToken,
  type CalendarConnectionRow,
} from "@/lib/calendar/connection-tokens";
import { refreshGoogleAccessToken } from "@/lib/calendar/google";
import { createServiceClient } from "@/lib/supabase/server";

const CALENDAR_LINK_PATTERN =
  /calendar\.app\.google|calendar\.google\.com|google\.com\/calendar/i;

export type ResolveMeetingUrlOptions = {
  userId?: string;
  organizationId?: string;
};

export function isCalendarSchedulingLink(url: string): boolean {
  return CALENDAR_LINK_PATTERN.test(url);
}

export function isDirectMeetingLink(url: string): boolean {
  return detectMeetingPlatform(url) !== "unknown";
}

async function followRedirectsForEid(input: string): Promise<string> {
  let current = input;
  for (let i = 0; i < 5; i++) {
    if (parseGoogleCalendarEventLink(current)) return current;
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MeetMind/1.0)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).href;
      continue;
    }
    break;
  }
  return current;
}

async function resolveViaGoogleCalendarApi(
  userId: string,
  organizationId: string,
  calendarPageUrl: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .maybeSingle();

  if (!connection) return null;

  const row = connection as CalendarConnectionRow;
  let accessToken = getPlainAccessToken(row);
  const refreshToken = getPlainRefreshToken(row);

  if (
    row.token_expires_at &&
    new Date(row.token_expires_at) <= new Date() &&
    refreshToken
  ) {
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
      .eq("id", row.id);
  }

  const resolvedUrl = await followRedirectsForEid(calendarPageUrl);
  const ids = parseGoogleCalendarEventLink(resolvedUrl);
  if (!ids) return null;

  const event = await fetchGoogleCalendarEvent(
    accessToken,
    ids.calendarId,
    ids.eventId,
  );
  if (!event) return null;

  return meetingUrlFromGoogleEvent(event);
}

/**
 * Converts Google Calendar appointment/event pages into a direct Meet/Zoom/Teams join URL.
 */
export async function resolveMeetingUrl(
  input: string,
  options?: ResolveMeetingUrlOptions,
): Promise<
  | { ok: true; meetingUrl: string; resolvedFrom?: string }
  | { ok: false; error: string }
> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Meeting URL is required" };
  }

  if (isDirectMeetingLink(trimmed)) {
    return { ok: true, meetingUrl: trimmed };
  }

  const meetCodeOnly = trimmed.match(/^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i);
  if (meetCodeOnly?.[1]) {
    return {
      ok: true,
      meetingUrl: `https://meet.google.com/${meetCodeOnly[1].toLowerCase()}`,
    };
  }

  if (!isCalendarSchedulingLink(trimmed)) {
    return {
      ok: false,
      error:
        "Use a direct Meet link (meet.google.com/abc-defg-hij), a Meet code, or a Google Calendar event link.",
    };
  }

  if (options?.userId && options?.organizationId) {
    try {
      const fromApi = await resolveViaGoogleCalendarApi(
        options.userId,
        options.organizationId,
        trimmed,
      );
      if (fromApi && isDirectMeetingLink(fromApi)) {
        return { ok: true, meetingUrl: fromApi, resolvedFrom: trimmed };
      }
    } catch {
      /* fall through to HTML scrape */
    }
  }

  try {
    const res = await fetch(trimmed, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MeetMind/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      return calendarLinkHelp(options?.userId);
    }

    const html = await res.text();
    const meetingUrl = extractMeetingUrl(html);

    if (!meetingUrl || !isDirectMeetingLink(meetingUrl)) {
      return calendarLinkHelp(options?.userId);
    }

    return { ok: true, meetingUrl, resolvedFrom: trimmed };
  } catch {
    return calendarLinkHelp(options?.userId);
  }
}

function calendarLinkHelp(hasUser?: string): {
  ok: false;
  error: string;
} {
  return {
    ok: false,
    error: hasUser
      ? "Could not read a Meet link from that calendar page. Connect Google Calendar on the Calendar page and try again, or paste the direct Meet link (meet.google.com/abc-defg-hij) from the event."
      : "Could not read a Meet link from that calendar page. Paste the direct “Join with Google Meet” link (meet.google.com/abc-defg-hij) from the event.",
  };
}
