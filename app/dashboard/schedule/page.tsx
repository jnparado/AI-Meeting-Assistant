import { redirect } from "next/navigation";
import { ScheduleMeetInvite } from "@/components/schedule-meet-invite";
import { GoogleCalendarRedirectHint } from "@/components/google-calendar-redirect-hint";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";

export const dynamic = "force-dynamic";

export default async function ScheduleMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/schedule");
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) {
    redirect("/dashboard/meetings");
  }

  const { count } = await supabase
    .from("calendar_connections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("organization_id", organization.id)
    .eq("provider", "google");

  const hasGoogleCalendar = (count ?? 0) > 0;
  const googleOAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {params.connected === "google" && (
        <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          Google Calendar connected. You can schedule a Meet below.
        </p>
      )}
      {params.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Could not connect Google Calendar</p>
          <p className="mt-1">{params.detail ?? "Try again using the button below."}</p>
        </div>
      )}
      {!hasGoogleCalendar && (
        <GoogleCalendarRedirectHint enabled={googleOAuthConfigured} />
      )}
      <ScheduleMeetInvite hasGoogleCalendar={hasGoogleCalendar} />
    </div>
  );
}
