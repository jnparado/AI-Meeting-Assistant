import Link from "next/link";
import { getActiveOrganization } from "@/lib/org/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AssistantToggle } from "@/components/assistant-toggle";
import { BotStatusTimeline } from "@/components/bot-status-timeline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActionItem, BotStatus } from "@/lib/types/database";

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

  const organization = await getActiveOrganization(user!.id);
  if (!organization) notFound();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();

  if (!meeting) notFound();

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

  const when = new Date(meeting.starts_at).toLocaleString();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/meetings"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to dashboard
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{meeting.title}</h1>
          <p className="text-muted-foreground">{when}</p>
          {meeting.meeting_url && (
            <a
              href={meeting.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Open conference link
            </a>
          )}
        </div>
        <AssistantToggle
          meetingId={meeting.id}
          meetingUrl={meeting.meeting_url}
          enabled={meeting.ai_assistant_enabled}
        />
      </div>

      {bot && (
        <BotStatusTimeline
          status={bot.status as BotStatus}
          botName={bot.bot_name}
          scheduledFor={bot.scheduled_for}
          failureReason={bot.failure_reason}
        />
      )}

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{summary.summary}</p>
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
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {transcript?.full_text && (
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
      )}
    </div>
  );
}
