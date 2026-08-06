import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { MeetingCard } from "@/components/meeting-card";
import { SyncCalendarButton } from "@/components/sync-calendar-button";
import { DemoMeetingsButton } from "@/components/demo-meetings-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function MeetingsDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="text-xl font-semibold">Setup required</h1>
        <p className="text-muted-foreground text-sm">
          Your account is signed in, but the database workspace tables are missing
          or could not be initialized. Run the SQL migrations in{" "}
          <code className="text-xs">supabase/migrations/</code> in the Supabase
          SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const now = new Date();
  const { data: meetings } = await supabase
    .from("meetings")
    .select(
      "id, title, starts_at, platform, ai_assistant_enabled, meeting_url",
    )
    .eq("organization_id", organization.id)
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);

  const meetingIds = meetings?.map((m) => m.id) ?? [];
  const { data: summaries } = meetingIds.length
    ? await supabase
        .from("meeting_summaries")
        .select("meeting_id")
        .in("meeting_id", meetingIds)
    : { data: [] };

  const summarySet = new Set(summaries?.map((s) => s.meeting_id));

  const { count: connectionCount } = await supabase
    .from("calendar_connections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("organization_id", organization.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            {organization.name} — upcoming meetings
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SyncCalendarButton />
          <DemoMeetingsButton />
          <Link
            href="/dashboard/connect"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Connect calendar
          </Link>
        </div>
      </div>

      {!connectionCount && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect a calendar</CardTitle>
            <CardDescription>
              After sign-in, connect Google Calendar or Microsoft Outlook to
              import events with meeting links. Tokens are encrypted and never
              sent to the browser.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section id="upcoming-meetings" className="space-y-4 scroll-mt-8">
        <h2 className="text-lg font-medium">Upcoming meetings</h2>
        {!meetings?.length ? (
          <p className="text-sm text-muted-foreground">
            No upcoming meetings. Connect a calendar and import events, or load
            demo meetings.
          </p>
        ) : (
          <div className="grid gap-4">
            {meetings.map((m) => (
              <MeetingCard
                key={m.id}
                id={m.id}
                title={m.title}
                startsAt={m.starts_at}
                platform={m.platform}
                assistantEnabled={m.ai_assistant_enabled}
                hasSummary={summarySet.has(m.id)}
                meetingUrl={m.meeting_url}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
