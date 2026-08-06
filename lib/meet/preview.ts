const MEET_CODE_PATTERN =
  /(?:https?:\/\/)?meet\.google\.com\/([a-z]{3,4}-[a-z]{3,4}-[a-z]{3,4})(?:\?.*)?$/i;

export function parseGoogleMeetCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const full = trimmed.match(MEET_CODE_PATTERN);
  if (full?.[1]) return full[1].toLowerCase();

  const bare = trimmed.match(/^([a-z]{3,4}-[a-z]{3,4}-[a-z]{3,4})$/i);
  if (bare?.[1]) return bare[1].toLowerCase();

  return null;
}

export function toGoogleMeetUrl(code: string): string {
  return `https://meet.google.com/${code}`;
}

/** Preview image shown for known / demo Meet codes (lobby screenshot). */
export function getMeetPreviewImagePath(code: string): string {
  const known = new Set(["kvn-chcf-zsg", "nrk-nmgm-ceu", "abc-defg-hij"]);
  if (known.has(code.toLowerCase())) {
    return "/meet-previews/google-meet-lobby.png";
  }
  return "/meet-previews/google-meet-lobby.png";
}
