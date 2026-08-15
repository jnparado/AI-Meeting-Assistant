import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { SyncCalendarButton } from "@/components/sync-calendar-button";
import { GoogleCalendarRedirectHint } from "@/components/google-calendar-redirect-hint";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ConnectCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/connect");

  const organization = await getActiveOrganization(user.id);

  const { count: googleCount } = await supabase
    .from("calendar_connections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("organization_id", organization?.id ?? "")
    .eq("provider", "google");

  const hasGoogleConnection = (googleCount ?? 0) > 0;
  const hasConnection = hasGoogleConnection;
  const googleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
  const microsoftOAuthConfigured = Boolean(process.env.MICROSOFT_CLIENT_ID?.trim());

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Connect your calendar</h1>
        <p className="text-muted-foreground">
          Import upcoming Google Meet, Zoom, and Teams events. OAuth tokens are
          stored encrypted on the server only.
        </p>
        {params.connected && (
          <p className="mt-2 text-sm text-primary">
            {params.connected === "google" ? "Google" : "Microsoft"} Calendar
            connected. Import your meetings below.
          </p>
        )}
        {params.error && (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Calendar connection failed</p>
            <p className="mt-1">
              {params.error === "google" || params.error === "token"
                ? params.detail ??
                  "Google rejected the connection. Check redirect URIs below."
                : params.error === "db"
                  ? `Could not save connection: ${params.detail ?? "database error"}`
                  : params.detail ??
                    "OAuth session failed. Click Connect again (avoid the browser back button)."}
            </p>
            {(params.error === "google" ||
              params.error === "token" ||
              params.detail?.includes("redirect_uri")) && (
              <p className="mt-2 text-xs">
                If Google showed <strong>redirect_uri_mismatch</strong>, add every
                redirect URI listed below in Google Cloud Console.
              </p>
            )}
          </div>
        )}
      </div>

      <GoogleCalendarRedirectHint
        showAlways={Boolean(params.error) || !hasGoogleConnection}
        enabled={googleOAuthConfigured}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a provider</CardTitle>
          <CardDescription>
            Permissions include reading upcoming events and meeting links, plus
            creating and updating events when you schedule assistants.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {googleOAuthConfigured ? (
            <Link
              href="/api/oauth/google"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Connect Google Calendar
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              Google Calendar: set <code className="text-xs">GOOGLE_CLIENT_ID</code>{" "}
              and <code className="text-xs">GOOGLE_CLIENT_SECRET</code> in{" "}
              <code className="text-xs">.env.local</code> (see{" "}
              <code className="text-xs">.env.example</code>).
            </p>
          )}
          {microsoftOAuthConfigured ? (
            <Link
              href="/api/oauth/microsoft"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Connect Microsoft Outlook
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              Microsoft: set <code className="text-xs">MICROSOFT_CLIENT_ID</code>{" "}
              and <code className="text-xs">MICROSOFT_CLIENT_SECRET</code> in{" "}
              <code className="text-xs">.env.local</code>.
            </p>
          )}
        </CardContent>
      </Card>

      {hasConnection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import meetings</CardTitle>
            <CardDescription>
              Pull the next 30 days of events with video links into your company
              workspace, or{" "}
              <Link
                href="/dashboard/schedule"
                className="text-primary underline-offset-4 hover:underline"
              >
                schedule a new Google Meet
              </Link>{" "}
              with email invites.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/dashboard/schedule" className={cn(buttonVariants())}>
              Schedule Google Meet
            </Link>
            <SyncCalendarButton />
            <Link href="/dashboard/meetings" className={cn(buttonVariants({ variant: "outline" }))}>
              Go to meetings
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
