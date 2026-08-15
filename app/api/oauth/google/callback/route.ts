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

function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/connect";
  }
  return value;
}

function redirectWithError(
  returnTo: string,
  code: string,
  detail?: string,
): NextResponse {
  const url = new URL(`${getAppUrl()}${returnTo}`);
  url.searchParams.set("error", code);
  if (detail) {
    url.searchParams.set("detail", detail.slice(0, 240));
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state_google")?.value;
  const organizationId = cookieStore.get("oauth_organization_id")?.value;
  const returnTo = safeReturnPath(
    cookieStore.get("oauth_return_to")?.value ?? "/dashboard/connect",
  );

  cookieStore.delete("oauth_return_to");

  if (googleError) {
    return redirectWithError(
      returnTo,
      "google",
      searchParams.get("error_description") ?? googleError,
    );
  }

  if (!code || !state || state !== savedState || !organizationId) {
    return redirectWithError(
      returnTo,
      "oauth",
      !code
        ? "Missing authorization code from Google."
        : state !== savedState
          ? "OAuth session expired — click Connect again (do not use back button)."
          : "Missing workspace context — try Connect again.",
    );
  }

  cookieStore.delete("oauth_state_google");
  cookieStore.delete("oauth_organization_id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login?next=${encodeURIComponent(returnTo)}`);
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

  const tokenText = await tokenRes.text();
  if (!tokenRes.ok) {
    console.error("[oauth/google/callback] token exchange failed:", tokenText);
    let detail = `Token exchange failed (${tokenRes.status}).`;
    try {
      const parsed = JSON.parse(tokenText) as { error_description?: string; error?: string };
      detail = parsed.error_description ?? parsed.error ?? detail;
    } catch {
      /* use default */
    }
    return redirectWithError(returnTo, "token", detail);
  }

  const tokens = JSON.parse(tokenText) as {
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
  const { error: upsertError } = await service.from("calendar_connections").upsert(
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

  if (upsertError) {
    console.error("[oauth/google/callback] upsert failed:", upsertError);
    return redirectWithError(returnTo, "db", upsertError.message);
  }

  const successUrl = new URL(`${getAppUrl()}${returnTo}`);
  successUrl.searchParams.set("connected", "google");
  return NextResponse.redirect(successUrl.toString());
}
