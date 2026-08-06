import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatBotStatus,
  getBotTimelineSteps,
} from "@/lib/bot/status-timeline";
import type { BotStatus } from "@/lib/types/database";

type Props = {
  status: BotStatus;
  botName?: string | null;
  scheduledFor?: string;
  failureReason?: string | null;
};

export function BotStatusTimeline({
  status,
  botName,
  scheduledFor,
  failureReason,
}: Props) {
  const steps = getBotTimelineSteps(status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI assistant status</CardTitle>
        <CardDescription>
          {botName ? `${botName} · ` : ""}
          {formatBotStatus(status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2">
              <span
                className={
                  step.reached
                    ? "text-primary"
                    : "text-muted-foreground/50"
                }
                aria-hidden
              >
                {step.reached ? "✓" : "○"}
              </span>
              <span
                className={
                  step.current
                    ? "font-medium text-foreground"
                    : step.reached
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }
              >
                {step.label}
                {step.current ? "…" : ""}
              </span>
            </li>
          ))}
        </ul>
        {scheduledFor && (
          <p className="text-xs text-muted-foreground">
            Scheduled join: {new Date(scheduledFor).toLocaleString()}
          </p>
        )}
        {failureReason && (
          <p className="text-sm text-destructive">{failureReason}</p>
        )}
      </CardContent>
    </Card>
  );
}
