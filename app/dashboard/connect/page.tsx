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
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/connect");

  const organization = await getActiveOrganization(user.id);

  const { count } = await supabase
    .from("calendar_connections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("organization_id", organization?.id ?? "");

  const hasConnection = (count ?? 0) > 0;
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
          <p className="mt-2 text-sm text-destructive">
            Calendar connection failed. If Google showed{" "}
            <strong>redirect_uri_mismatch</strong>, add the redirect URI below in
            Google Cloud Console, then try again.
          </p>
        )}
      </div>

      <GoogleCalendarRedirectHint
        showAlways={Boolean(params.error) || googleOAuthConfigured}
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
              workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <SyncCalendarButton />
            <Link href="/dashboard/meetings" className={cn(buttonVariants())}>
              Go to meetings
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
