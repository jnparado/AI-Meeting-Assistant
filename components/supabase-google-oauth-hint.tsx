import { getGoogleOAuthRedirectUris } from "@/lib/oauth/google-setup";

type Props = {
  /** Force show (e.g. troubleshooting). */
  showAlways?: boolean;
  /** Show after sign-in callback failed (redirect_uri_mismatch, etc.). */
  showOnError?: boolean;
};

/** Google Cloud redirect URI for Supabase “Sign in with Google”. */
export function SupabaseGoogleOAuthHint({
  showAlways = false,
  showOnError = false,
}: Props) {
  const isDev = process.env.NODE_ENV === "development";
  if (!showAlways && !showOnError && !isDev) return null;

  const { supabaseSignIn, appAuthCallback, calendarConnect } =
    getGoogleOAuthRedirectUris();

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Sign in with Google (Supabase)</p>
      <p className="mt-1 text-muted-foreground">
        In Google Cloud → Credentials → the client used in{" "}
        <strong className="font-medium text-foreground">
          Supabase → Auth → Google
        </strong>
        , add this <strong className="font-medium text-foreground">Authorized
        redirect URI</strong> (fixes Error 400{" "}
        <code className="text-xs">redirect_uri_mismatch</code> on Google sign-in):
      </p>
      <code className="mt-2 block break-all rounded-md border border-border bg-background px-2 py-2 text-xs text-foreground">
        {supabaseSignIn}
      </code>
      <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
        Must end with <code className="text-foreground">/auth/v1/callback</code>.
        If you only added{" "}
        <code className="text-foreground">…supabase.co</code> with no path, Google
        shows &quot;requested path is invalid&quot;.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Do <strong className="font-medium text-foreground">not</strong> put your app
        URL or <code className="text-xs">/auth/callback</code> in Google redirect
        URIs for sign-in — only the Supabase URL above.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Supabase → Redirect URLs:{" "}
        <code className="break-all text-foreground">{appAuthCallback}</code>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Calendar (separate): also add{" "}
        <code className="break-all text-foreground">{calendarConnect}</code> on the
        same Web client if you use one Google app for both.
      </p>
    </div>
  );
}
