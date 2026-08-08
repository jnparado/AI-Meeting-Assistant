import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getGoogleOAuthRedirectUris } from "@/lib/oauth/google-setup";

function supabaseProvidersDashboardUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    if (ref) {
      return `https://supabase.com/dashboard/project/${ref}/auth/providers`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function GoogleOAuthSetupHelp() {
  const uris = getGoogleOAuthRedirectUris();
  const providersUrl = supabaseProvidersDashboardUrl();

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base">Google sign-in setup</CardTitle>
        <CardDescription>
          If the Google button shows{" "}
          <code className="text-xs">provider is not enabled</code>, complete step 1
          in Supabase (not only in <code className="text-xs">.env.local</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ol className="list-decimal space-y-2 pl-4 text-muted-foreground">
          <li>
            {providersUrl ? (
              <>
                Open{" "}
                <Link
                  href={providersUrl}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase → Authentication → Providers
                </Link>
              </>
            ) : (
              <>Open Supabase Dashboard → Authentication → Providers</>
            )}
            , enable <strong className="text-foreground">Google</strong>, and paste
            your Google OAuth Client ID and Client Secret.
          </li>
          <li>
            In Google Cloud Console → Credentials → OAuth client → Authorized
            redirect URIs, add:
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
              {uris.supabaseSignIn}
            </code>
          </li>
          <li>
            Supabase → Authentication → URL configuration → Redirect URLs, add:
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
              {uris.appAuthCallback}
            </code>
          </li>
        </ol>
        <div className="border-t border-amber-500/20 pt-3">
          <p className="font-medium text-foreground">Calendar connect (separate)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connecting Google Calendar uses{" "}
            <code className="text-foreground">{uris.calendarConnect}</code> and{" "}
            <code className="text-foreground">GOOGLE_CLIENT_ID</code> in{" "}
            <code className="text-foreground">.env.local</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
