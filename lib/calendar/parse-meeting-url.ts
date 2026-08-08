import type { MeetingPlatform } from "@/lib/types/database";

export function detectMeetingPlatform(url: string | null | undefined): MeetingPlatform {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.includes("meet.google.com")) return "google_meet";
  if (lower.includes("zoom.us") || lower.includes("zoom.com")) return "zoom";
  if (
    lower.includes("teams.microsoft.com") ||
    lower.includes("teams.live.com")
  ) {
    return "teams";
  }
  return "unknown";
}

export function extractMeetingUrl(text: string): string | null {
  const normalized = text
    .replace(/\\u002f/gi, "/")
    .replace(/\\u002d/gi, "-")
    .replace(/&#x2f;/gi, "/")
    .replace(/&amp;/g, "&");

  const urlMatch = normalized.match(
    /https?:\/\/[^\s<>"']+(?:meet\.google\.com|zoom\.(?:us|com)|teams\.(?:microsoft|live)\.com)[^\s<>"']*/i,
  );
  if (urlMatch?.[0]) return urlMatch[0].replace(/[.,;]+$/, "");

  const meetCode = normalized.match(/\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i);
  if (meetCode?.[1]) {
    return `https://meet.google.com/${meetCode[1].toLowerCase()}`;
  }

  return null;
}

const platformTitles: Record<MeetingPlatform, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  unknown: "Video call",
};

export function meetingTitleForPlatform(platform: MeetingPlatform): string {
  return `Live ${platformTitles[platform]}`;
}
