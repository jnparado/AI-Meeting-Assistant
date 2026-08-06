import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { encryptedTokens } from "@/lib/calendar/connection-tokens";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state_microsoft")?.value;
  const organizationId = cookieStore.get("oauth_organization_id")?.value;

  if (!code || !state || state !== savedState || !organizationId) {
    return NextResponse.redirect(`${getAppUrl()}/dashboard/connect?error=oauth`);
  }

  cookieStore.delete("oauth_state_microsoft");
  cookieStore.delete("oauth_organization_id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login`);
  }

  const tenant = process.env.MICROSOFT_TENANT_ID ?? "common";
  const redirectUri = `${getAppUrl()}/api/oauth/microsoft/callback`;
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    },
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${getAppUrl()}/dashboard/connect?error=token`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as { id?: string; mail?: string };

  const calendarRes = await fetch("https://graph.microsoft.com/v1.0/me/calendar", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const calendar = calendarRes.ok
    ? ((await calendarRes.json()) as { id?: string })
    : { id: null };

  const sealed = encryptedTokens({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  });

  const service = createServiceClient();
  await service.from("calendar_connections").upsert(
    {
      user_id: user.id,
      organization_id: organizationId,
      provider: "microsoft",
      provider_account_id: profile.id ?? profile.mail ?? "microsoft",
      access_token: sealed.access_token,
      refresh_token: sealed.refresh_token,
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      calendar_id: calendar.id ?? null,
      scopes: tokens.scope?.split(" ") ?? [],
    },
    { onConflict: "user_id,organization_id,provider" },
  );

  return NextResponse.redirect(
    `${getAppUrl()}/dashboard/connect?connected=microsoft`,
  );
}
