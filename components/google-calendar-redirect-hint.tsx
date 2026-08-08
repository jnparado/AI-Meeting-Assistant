import { getGoogleCalendarRedirectUri } from "@/lib/oauth/google-setup";

type Props = {
  showAlways?: boolean;
  /** When false, hint is hidden unless showAlways (e.g. after OAuth error). */
  enabled?: boolean;
};

export function GoogleCalendarRedirectHint({
  showAlways,
  enabled = true,
}: Props) {
  const uri = getGoogleCalendarRedirectUri();
  const isDev = process.env.NODE_ENV === "development";
  if (!enabled && !showAlways) return null;
  if (!showAlways && !isDev) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Google Calendar redirect URI</p>
      <p className="mt-1 text-muted-foreground">
        In Google Cloud → APIs &amp; Services → Credentials → your{" "}
        <strong className="font-medium text-foreground">Web client</strong> →
        Authorized redirect URIs, add this URL exactly (fixes Error 400{" "}
        <code className="text-xs">redirect_uri_mismatch</code>):
      </p>
      <code className="mt-2 block break-all rounded-md border border-border bg-background px-2 py-2 text-xs text-foreground">
        {uri}
      </code>
      <p className="mt-2 text-xs text-muted-foreground">
        Use the same OAuth client as{" "}
        <code className="text-foreground">GOOGLE_CLIENT_ID</code> in your env (
        <code className="text-foreground">.env.local</code> locally, Vercel env on
        production). Calendar OAuth is separate from Supabase Google sign-in.
      </p>
    </div>
  );
}
