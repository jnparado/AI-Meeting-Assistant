import { getAppUrl } from "@/lib/env";

/** Redirect URI for Google Calendar OAuth (must match Google Cloud Console exactly). */
export function getGoogleCalendarRedirectUri(): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (override) return override.replace(/\/$/, "");
  const appUrl = getAppUrl().replace(/\/$/, "");
  return `${appUrl}/api/oauth/google/callback`;
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
