import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AssistantToggle } from "@/components/assistant-toggle";
import type { MeetingPlatform } from "@/lib/types/database";

const platformLabel: Record<MeetingPlatform, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  unknown: "Video call",
};

type Props = {
  id: string;
  title: string;
  startsAt: string;
  platform: MeetingPlatform;
  assistantEnabled: boolean;
  hasSummary: boolean;
  meetingUrl: string | null;
};

export function MeetingCard({
  id,
  title,
  startsAt,
  platform,
  assistantEnabled,
  hasSummary,
  meetingUrl,
}: Props) {
  const start = new Date(startsAt);
  const dateLabel = start.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{title}</CardTitle>
              {hasSummary && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Summary ready
                </span>
              )}
            </div>
            <CardDescription className="text-sm">
              {platformLabel[platform]}
            </CardDescription>
            <p className="text-sm text-muted-foreground">
              {dateLabel}
              <br />
              {timeLabel}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <AssistantToggle
              meetingId={id}
              meetingUrl={meetingUrl}
              enabled={assistantEnabled}
            />
            <Link
              href={`/dashboard/meetings/${id}`}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              View details
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">
        {assistantEnabled ? "AI assistant scheduled for this meeting." : null}
      </CardContent>
    </Card>
  );
}
