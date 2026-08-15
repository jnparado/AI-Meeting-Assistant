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
      .or(
        `organization_id.eq.${organization.id},and(user_id.eq.${user.id},organization_id.is.null)`,
      )
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(50),
    supabase
      .from("meetings")
      .select(
        "id, title, starts_at, platform, ai_assistant_enabled, meeting_url",
      )
      .or(
        `organization_id.eq.${organization.id},and(user_id.eq.${user.id},organization_id.is.null)`,
      )
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(30),
  ]);

  const allIds = [...(upcoming ?? []), ...(past ?? [])].map((m) => m.id);
  const summarySet = await loadSummaryIds(supabase, allIds);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">
            AI notetaker sessions — join with a link, review summaries here
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/join" className={cn(buttonVariants({ size: "lg" }))}>
            Paste link &amp; join
          </Link>
          <Link
            href="/dashboard/schedule"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            Schedule Meet
          </Link>
          <Link
            href="/dashboard/connect"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Calendar (optional)
          </Link>
        </div>
      </div>

      <Card className="glass-panel border-primary/15">
        <CardHeader>
          <CardTitle className="text-base">MVP flow</CardTitle>
          <CardDescription className="leading-relaxed">
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                <Link
                  href="/dashboard/schedule"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Schedule a Google Meet
                </Link>{" "}
                (creates calendar event + email invites) or{" "}
                <Link href="/join" className="text-primary underline-offset-4 hover:underline">
                  paste an existing Meet link
                </Link>
                .
              </li>
              <li>
                Click Join — the bot enters as a visible participant
                {process.env.RECALL_VOICE_AGENT_ENABLED === "true" ||
                process.env.RECALL_VOICE_AGENT_ENABLED === "1"
                  ? " and can speak when voice agent mode is enabled."
                  : " (enable RECALL_VOICE_AGENT_ENABLED for live conversation)."}
              </li>
              <li>Admit the bot from the lobby if prompted.</li>
              <li>When the call ends, open the meeting for transcript, summary, and action items.</li>
              <li>
                Approve the email summary on the meeting page before it is sent (
                <Link
                  href="/dashboard/settings"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  notification email
                </Link>
                ).
              </li>
            </ol>
          </CardDescription>
        </CardHeader>
      </Card>

      {process.env.NODE_ENV === "development" && (
        <div className="flex flex-wrap gap-2">
          <SyncCalendarButton />
          <DemoMeetingsButton />
        </div>
      )}

      <section id="upcoming-meetings" className="space-y-4 scroll-mt-8">
        <h2 className="text-lg font-medium">Upcoming</h2>
        {!upcoming?.length ? (
          <p className="text-sm text-muted-foreground">
            No upcoming meetings yet.{" "}
            <Link href="/join" className="text-primary underline-offset-4 hover:underline">
              Join with a meeting link
            </Link>{" "}
            to get started.
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
