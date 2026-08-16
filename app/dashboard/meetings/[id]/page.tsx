import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveOrganization } from "@/lib/org/server";
import { ensureUserWorkspaceFromSession } from "@/lib/org/ensure-workspace";
import { createClient } from "@/lib/supabase/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import { canUseRecallVoiceAgent } from "@/lib/bot/recall-voice-agent";
import { BotMonitorPanel } from "@/components/bot-monitor-panel";
import { MeetingQnaPanel } from "@/components/meeting-qna-panel";
import { EmailSummaryApproval } from "@/components/email-summary-approval";
import type { MeetingInsights } from "@/lib/ai/summarize-meeting";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActionItem, BotStatus, TranscriptSegment } from "@/lib/types/database";

const platformLabel: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  unknown: "Video call",
};

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/meetings/${id}`)}`);
  }

  let organization = await getActiveOrganization(user.id);
  if (!organization) {
    await ensureUserWorkspaceFromSession();
    organization = await getActiveOrganization(user.id);
  }

  const meeting = await loadMeetingForUserSecure(
    id,
    user.id,
    organization?.id ?? null,
  );

  if (!meeting) {
    redirect("/dashboard/meetings?error=meeting-not-found");
  }

  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("*")
    .eq("meeting_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: summary } = await supabase
    .from("meeting_summaries")
    .select("*")
    .eq("meeting_id", id)
    .maybeSingle();

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("full_text, segments")
    .eq("meeting_id", id)
    .maybeSingle();

  const { data: followUps } = await supabase
    .from("follow_up_jobs")
    .select("id, channel, status, sent_at, error_message, payload")
    .eq("meeting_id", id)
    .order("created_at", { ascending: false });

  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select("notification_email, follow_up_email")
    .eq("organization_id", organization?.id ?? meeting.organization_id)
    .maybeSingle();

  const emailApprovalJob = followUps?.find(
    (j) => j.channel === "email" && j.status === "awaiting_approval",
  );
  const emailInsights = emailApprovalJob?.payload as MeetingInsights | undefined;

  const segments = (transcript?.segments as TranscriptSegment[] | null) ?? [];
  const when = new Date(String(meeting.starts_at ?? Date.now())).toLocaleString();
  const hasTranscript = Boolean(
    transcript?.full_text || segments.length > 0,
  );
  const liveStatuses = new Set<BotStatus>([
    "joining",
    "waiting_room",
    "joined",
    "recording",
  ]);
  const isLive = bot?.status ? liveStatuses.has(bot.status as BotStatus) : false;
  const voiceAgentEnabled = canUseRecallVoiceAgent();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/meetings"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to meetings
      </Link>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {platformLabel[String(meeting.platform ?? "unknown")] ?? "Meeting"}
        </p>
        <h1 className="text-2xl font-semibold">{String(meeting.title ?? "Meeting")}</h1>
        <p className="text-muted-foreground">{when}</p>
        {meeting.meeting_url && (
          <a
            id="open-meet-link"
            href={meeting.meeting_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Open conference link (optional — for you, not the bot)
          </a>
        )}
      </div>

      <Suspense fallback={null}>
        <BotMonitorPanel
          meetingId={id}
          meetingUrl={(meeting.meeting_url as string | null) ?? null}
          initialBotName={(bot?.bot_name as string | null) ?? null}
          initialBotStatus={(bot?.status as BotStatus | undefined) ?? null}
          initialIsLive={isLive}
          hasBot={Boolean(bot)}
          aiAssistantEnabled={Boolean(meeting.ai_assistant_enabled)}
          voiceAgentEnabled={voiceAgentEnabled}
          initialSegments={segments}
        />
      </Suspense>

      {summary && emailInsights && integrations?.follow_up_email !== false ? (
        <EmailSummaryApproval
          meetingId={id}
          insights={emailInsights}
          notificationEmail={integrations?.notification_email ?? user.email ?? null}
        />
      ) : null}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{summary.summary}</p>
            {(summary.key_topics as string[])?.length > 0 && (
              <div>
                <h3 className="font-medium">Key topics</h3>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {(summary.key_topics as string[]).map((t) => (
                    <li
                      key={t}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.decisions?.length > 0 && (
              <div>
                <h3 className="font-medium">Decisions</h3>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {(summary.decisions as string[]).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {(summary.action_items as ActionItem[])?.length > 0 && (
              <div>
                <h3 className="font-medium">Action items</h3>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {(summary.action_items as ActionItem[]).map((a) => (
                    <li key={a.task}>
                      {a.task}
                      {a.owner ? ` — ${a.owner}` : ""}
                      {a.due ? ` (due ${a.due})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <MeetingQnaPanel
        meetingId={id}
        hasTranscript={hasTranscript}
        isLive={isLive}
        hasBot={Boolean(bot)}
        initialSegments={segments}
        hideBotControls={Boolean(bot)}
      />

      {followUps && followUps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {followUps.map((job, i) => (
                <li
                  key={`${job.channel}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <span className="capitalize">{job.channel}</span>
                  <span
                    className={
                      job.status === "sent"
                        ? "text-primary"
                        : job.status === "failed"
                          ? "text-destructive"
                          : job.status === "awaiting_approval"
                            ? "text-amber-600 dark:text-amber-500"
                            : "text-muted-foreground"
                    }
                  >
                    {job.status === "awaiting_approval"
                      ? "awaiting your approval"
                      : job.status}
                    {job.error_message ? ` — ${job.error_message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {segments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript (by speaker)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {segments.map((seg, i) => (
              <div key={`${seg.speaker}-${i}`} className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs font-medium text-primary">{seg.speaker}</p>
                <p className="mt-1 text-muted-foreground">{seg.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        transcript?.full_text && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                {transcript.full_text}
              </pre>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
