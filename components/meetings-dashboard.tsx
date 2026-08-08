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

async function loadSummaryIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingIds: string[],
) {
  if (!meetingIds.length) return new Set<string>();
  const { data: summaries } = await supabase
    .from("meeting_summaries")
    .select("meeting_id")
    .in("meeting_id", meetingIds);
  return new Set(summaries?.map((s) => s.meeting_id) ?? []);
}

export async function MeetingsDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard/meetings");
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="text-xl font-semibold">Setup required</h1>
        <p className="text-muted-foreground text-sm">
          Run{" "}
          <code className="text-xs">supabase/RUN_IN_SQL_EDITOR.sql</code> in the
          Supabase SQL editor, then reload.
        </p>
      </div>
    );
  }

  const now = new Date().toISOString();

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id, title, starts_at, platform, ai_assistant_enabled, meeting_url",
      )
      .eq("organization_id", organization.id)
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("meetings")
      .select(
        "id, title, starts_at, platform, ai_assistant_enabled, meeting_url",
      )
      .eq("organization_id", organization.id)
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(30),
  ]);

  const allIds = [...(upcoming ?? []), ...(past ?? [])].map((m) => m.id);
  const summarySet = await loadSummaryIds(supabase, allIds);

  const { count: connectionCount } = await supabase
    .from("calendar_connections")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("organization_id", organization.id);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            {organization.name} — connect calendar, send AI to Meet, Zoom, or
            Teams
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/join" className={cn(buttonVariants())}>
            Join with AI now
          </Link>
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

      <Card className="glass-panel border-primary/15">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
          <CardDescription className="leading-relaxed">
            1. Connect Google or Microsoft calendar → 2. Sync events → 3. Enable
            the AI assistant on a meeting (or paste a link on{" "}
            <Link href="/join" className="text-primary underline-offset-4 hover:underline">
              Join with AI
            </Link>
            ) → 4. Admit the bot in the lobby → 5. Review transcript, summary,
            and action items here — follow-ups go to email, Slack, or HubSpot
            from{" "}
            <Link
              href="/dashboard/settings"
              className="text-primary underline-offset-4 hover:underline"
            >
              Settings
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>

      {!connectionCount && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect a calendar</CardTitle>
            <CardDescription>
              Import upcoming Google Meet, Zoom, and Teams links automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <section id="upcoming-meetings" className="space-y-4 scroll-mt-8">
        <h2 className="text-lg font-medium">Upcoming</h2>
        {!upcoming?.length ? (
          <p className="text-sm text-muted-foreground">
            No upcoming meetings. Sync your calendar or load demo meetings.
          </p>
        ) : (
          <div className="grid gap-4">
            {upcoming.map((m) => (
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

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Past meetings</h2>
        {!past?.length ? (
          <p className="text-sm text-muted-foreground">
            Completed meetings with transcripts and summaries appear here.
          </p>
        ) : (
          <div className="grid gap-4">
            {past.map((m) => (
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
