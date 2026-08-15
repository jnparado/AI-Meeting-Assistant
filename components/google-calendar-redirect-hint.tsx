import {
  getGoogleCalendarRedirectUri,
  getGoogleCalendarRedirectUrisToRegister,
} from "@/lib/oauth/google-setup";

type Props = {
  showAlways?: boolean;
  /** When false, hint is hidden unless showAlways (e.g. after OAuth error). */
  enabled?: boolean;
};

export function GoogleCalendarRedirectHint({
  showAlways = true,
  enabled = true,
}: Props) {
  const currentUri = getGoogleCalendarRedirectUri();
  const urisToRegister = getGoogleCalendarRedirectUrisToRegister();
  if (!enabled && !showAlways) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Google Calendar redirect URI</p>
      <p className="mt-1 text-muted-foreground">
        In Google Cloud → APIs &amp; Services → Credentials → your{" "}
        <strong className="font-medium text-foreground">Web client</strong> →
        Authorized redirect URIs, add{" "}
        <strong className="font-medium text-foreground">each URL below exactly</strong>{" "}
        (fixes Error 400 <code className="text-xs">redirect_uri_mismatch</code>):
      </p>
      <ul className="mt-2 space-y-2">
        {urisToRegister.map((uri) => (
          <li key={uri}>
            <code className="block break-all rounded-md border border-border bg-background px-2 py-2 text-xs text-foreground">
              {uri}
            </code>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Active redirect for this environment:{" "}
        <code className="text-foreground">{currentUri}</code>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Use the same OAuth client as{" "}
        <code className="text-foreground">GOOGLE_CLIENT_ID</code> in your env (
        <code className="text-foreground">.env.local</code> locally, Vercel env on
        production). Calendar OAuth is separate from Supabase Google sign-in. Set{" "}
        <code className="text-foreground">GOOGLE_OAUTH_PRODUCTION_APP_URL</code> in
        env to show your production callback here.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Still failing? In Google Cloud → OAuth consent screen: if the app is in{" "}
        <strong className="font-medium text-foreground">Testing</strong>, add your
        Gmail under <strong className="font-medium text-foreground">Test users</strong>.
        Enable the <strong className="font-medium text-foreground">Google Calendar API</strong>{" "}
        for this project.
      </p>
    </div>
  );
}
