import { getAppUrl } from "@/lib/env";

/** Redirect URI for Google Calendar OAuth (must match Google Cloud Console exactly). */
export function getGoogleCalendarRedirectUri(): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  const appUrl = getAppUrl().replace(/\/$/, "");
  return `${appUrl}/api/oauth/google/callback`;
}

/** All redirect URIs to register in Google Cloud (local + production). */
export function getGoogleCalendarRedirectUrisToRegister(): string[] {
  const uris = new Set<string>([
    "http://localhost:3000/api/oauth/google/callback",
    "http://127.0.0.1:3000/api/oauth/google/callback",
    getGoogleCalendarRedirectUri(),
  ]);

  const prodBase = process.env.GOOGLE_OAUTH_PRODUCTION_APP_URL?.trim()?.replace(
    /\/$/,
    "",
  );
  if (prodBase) {
    uris.add(`${prodBase}/api/oauth/google/callback`);
  }

  return [...uris];
}

export function getGoogleOAuthRedirectUris() {
  const appUrl = getAppUrl().replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  return {
    calendarConnect: getGoogleCalendarRedirectUri(),
    supabaseSignIn: supabaseUrl
      ? `${supabaseUrl}/auth/v1/callback`
      : "(set NEXT_PUBLIC_SUPABASE_URL)",
    appAuthCallback: `${appUrl}/auth/callback`,
  };
}
