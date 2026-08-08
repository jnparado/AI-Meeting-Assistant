import { getGoogleOAuthRedirectUris } from "@/lib/oauth/google-setup";

type Props = {
  showAlways?: boolean;
};

/** Dev helper: Google Cloud redirect URI for Supabase “Sign in with Google”. */
export function SupabaseGoogleOAuthHint({ showAlways }: Props) {
  const isDev = process.env.NODE_ENV === "development";
  if (!showAlways && !isDev) return null;

  const { supabaseSignIn, appAuthCallback } = getGoogleOAuthRedirectUris();

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
      <p className="mt-2 text-xs text-muted-foreground">
        In Supabase → Authentication → URL configuration → Redirect URLs, add:{" "}
        <code className="break-all text-foreground">{appAuthCallback}</code>
      </p>
    </div>
  );
}
