import { getAppUrl } from "@/lib/env";

export function getGoogleOAuthRedirectUris() {
  const appUrl = getAppUrl().replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

  return {
    calendarConnect: `${appUrl}/api/oauth/google/callback`,
    supabaseSignIn: supabaseUrl
      ? `${supabaseUrl}/auth/v1/callback`
      : "(set NEXT_PUBLIC_SUPABASE_URL)",
    appAuthCallback: `${appUrl}/auth/callback`,
  };
}
