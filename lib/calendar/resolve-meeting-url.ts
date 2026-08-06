import { extractMeetingUrl, detectMeetingPlatform } from "@/lib/calendar/parse-meeting-url";

const CALENDAR_LINK_PATTERN =
  /calendar\.app\.google|calendar\.google\.com|google\.com\/calendar/i;

export function isCalendarSchedulingLink(url: string): boolean {
  return CALENDAR_LINK_PATTERN.test(url);
}

export function isDirectMeetingLink(url: string): boolean {
  return detectMeetingPlatform(url) !== "unknown";
}

/**
 * Converts Google Calendar appointment/event pages into a direct Meet/Zoom/Teams join URL.
 * Bots (Recall.ai, etc.) cannot join calendar.app.google pages — only conference URLs.
 */
export async function resolveMeetingUrl(input: string): Promise<{
  ok: true;
  meetingUrl: string;
  resolvedFrom?: string;
} | {
  ok: false;
  error: string;
}> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Meeting URL is required" };
  }

  if (isDirectMeetingLink(trimmed)) {
    return { ok: true, meetingUrl: trimmed };
  }

  if (!isCalendarSchedulingLink(trimmed)) {
    return {
      ok: false,
      error:
        "Use a direct Google Meet link (meet.google.com/…), or a Google Calendar event link we can read.",
    };
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
      return {
        ok: false,
        error:
          "Could not open that calendar link. Paste the Meet link from the event instead (e.g. meet.google.com/abc-defg-hij).",
      };
    }

    const html = await res.text();
    const meetingUrl = extractMeetingUrl(html);

    if (!meetingUrl || !isDirectMeetingLink(meetingUrl)) {
      return {
        ok: false,
        error:
          "No Google Meet, Zoom, or Teams link found on that calendar page. Open the event and copy the “Join with Google Meet” link.",
      };
    }

    return { ok: true, meetingUrl, resolvedFrom: trimmed };
  } catch {
    return {
      ok: false,
      error:
        "Could not resolve that calendar link. Use the direct Meet URL from the event (for your AdMob meeting: meet.google.com/nrk-nmgm-ceu).",
    };
  }
}
