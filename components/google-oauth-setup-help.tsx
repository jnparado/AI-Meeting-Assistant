import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGoogleOAuthRedirectUris } from "@/lib/oauth/google-setup";

export function GoogleOAuthSetupHelp() {
  const uris = getGoogleOAuthRedirectUris();

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base">Fix Google Error 400: redirect_uri_mismatch</CardTitle>
        <CardDescription>
          In Google Cloud Console → APIs &amp; Services → Credentials → your OAuth
          client → <strong>Authorized redirect URIs</strong>, add{" "}
          <em>every</em> URI below (exact match, no trailing slash).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium">Connect Google Calendar (this app)</p>
          <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">
            {uris.calendarConnect}
          </code>
        </div>
        <div>
          <p className="font-medium">Sign in with Google (Supabase Auth)</p>
          <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">
            {uris.supabaseSignIn}
          </code>
        </div>
        <p className="text-muted-foreground text-xs">
          Supabase Dashboard → Authentication → URL configuration: add{" "}
          <code className="text-foreground">{uris.appAuthCallback}</code> under
          Redirect URLs. Use the same Google Client ID/Secret in Supabase → Auth →
          Providers → Google.
        </p>
      </CardContent>
    </Card>
  );
}
