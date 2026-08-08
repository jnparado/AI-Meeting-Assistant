import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { getGoogleCalendarRedirectUri } from "@/lib/oauth/google-setup";
import {
  encryptedTokens,
} from "@/lib/calendar/connection-tokens";
import {
  fetchGooglePrimaryCalendarId,
} from "@/lib/calendar/google";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state_google")?.value;
  const organizationId = cookieStore.get("oauth_organization_id")?.value;

  if (!code || !state || state !== savedState || !organizationId) {
    return NextResponse.redirect(`${getAppUrl()}/dashboard/connect?error=oauth`);
  }

  cookieStore.delete("oauth_state_google");
  cookieStore.delete("oauth_organization_id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login`);
  }

  const redirectUri = getGoogleCalendarRedirectUri();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${getAppUrl()}/dashboard/connect?error=token`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const profile = (await profileRes.json()) as { id?: string; email?: string };

  let calendarId = "primary";
  try {
    calendarId = await fetchGooglePrimaryCalendarId(tokens.access_token);
  } catch {
    calendarId = "primary";
  }

  const sealed = encryptedTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });

  const service = createServiceClient();
  await service.from("calendar_connections").upsert(
    {
      user_id: user.id,
      organization_id: organizationId,
      provider: "google",
      provider_account_id: profile.id ?? profile.email ?? "google",
      access_token: sealed.access_token,
      refresh_token: sealed.refresh_token,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      calendar_id: calendarId,
      scopes: tokens.scope?.split(" ") ?? [],
    },
    { onConflict: "user_id,organization_id,provider" },
  );

  return NextResponse.redirect(`${getAppUrl()}/dashboard/connect?connected=google`);
}
