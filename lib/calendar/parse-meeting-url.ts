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
  const urlMatch = text.match(
    /https?:\/\/[^\s<>"]+(?:meet\.google\.com|zoom\.(?:us|com)|teams\.(?:microsoft|live)\.com)[^\s<>"]*/i,
  );
  return urlMatch?.[0] ?? null;
}
