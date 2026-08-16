import type { BotStatus } from "@/lib/types/database";

export type BotTimelineStep = {
  id: string;
  label: string;
  reached: boolean;
  current: boolean;
};

const LABELS: Record<string, string> = {
  scheduled: "Bot scheduled",
  joining: "Bot joining meeting",
  waiting_room: "Waiting in lobby",
  joined: "Bot joined meeting",
  recording: "Recording started",
  meeting_ended: "Meeting ended",
  processing: "Processing transcript",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const DASHBOARD_STEPS = [
  { id: "scheduled", label: "Bot scheduled" },
  { id: "joined", label: "Bot joined meeting" },
  { id: "recording", label: "Recording started" },
  { id: "in_progress", label: "Meeting in progress" },
];

const PROGRESS: Record<BotStatus, number> = {
  scheduled: 0,
  joining: 0,
  waiting_room: 1,
  joined: 1,
  recording: 2,
  meeting_ended: 3,
  processing: 3,
  completed: 4,
  failed: 0,
  cancelled: 0,
};

export function getBotTimelineSteps(status: BotStatus): BotTimelineStep[] {
  if (status === "waiting_room") {
    return [
      {
        id: "scheduled",
        label: "Bot scheduled",
        reached: true,
        current: false,
      },
      {
        id: "waiting_room",
        label: "Waiting in lobby — admit the bot in Google Meet",
        reached: true,
        current: true,
      },
      {
        id: "joined",
        label: "Bot joined meeting",
        reached: false,
        current: false,
      },
      {
        id: "recording",
        label: "Recording started",
        reached: false,
        current: false,
      },
      {
        id: "in_progress",
        label: "Meeting in progress",
        reached: false,
        current: false,
      },
    ];
  }

  if (status === "failed" || status === "cancelled") {
    return [
      {
        id: status,
        label: LABELS[status],
        reached: true,
        current: true,
      },
    ];
  }

  if (status === "completed") {
    return DASHBOARD_STEPS.map((step) => ({
      ...step,
      reached: true,
      current: false,
    }));
  }

  const progress = PROGRESS[status];

  return DASHBOARD_STEPS.map((step, stepIdx) => ({
    ...step,
    reached: stepIdx < progress || (stepIdx === 3 && progress >= 3),
    current:
      status === "processing"
        ? step.id === "in_progress"
        : stepIdx === progress && progress < 3,
  }));
}

export function formatBotStatus(status: BotStatus): string {
  return LABELS[status] ?? status;
}

export type BotStatusTone = "neutral" | "active" | "success" | "warning" | "error";

export type BotStatusDisplay = {
  shortLabel: string;
  headline: string;
  detail: string;
  tone: BotStatusTone;
  progressStep: number;
  progressTotal: number;
};

const MONITOR_STEPS = [
  "Sent to Meet",
  "Connecting",
  "Waiting room",
  "In call",
  "Live",
] as const;

export function getBotMonitorSteps(): readonly string[] {
  return MONITOR_STEPS;
}

export function getBotStatusDisplay(
  status: BotStatus | null | undefined,
  options?: { botName?: string; justJoined?: boolean },
): BotStatusDisplay {
  const name = options?.botName?.trim() || "The bot";

  if (!status) {
    if (options?.justJoined) {
      return {
        shortLabel: "Sending to Meet",
        headline: `${name} is being sent to Google Meet`,
        detail: "This usually takes up to 30 seconds. Watch for them in the Meet waiting room.",
        tone: "active",
        progressStep: 1,
        progressTotal: MONITOR_STEPS.length,
      };
    }
    return {
      shortLabel: "Checking status",
      headline: "Checking where the bot is…",
      detail: "Status updates every few seconds.",
      tone: "neutral",
      progressStep: 0,
      progressTotal: MONITOR_STEPS.length,
    };
  }

  switch (status) {
    case "scheduled":
      return {
        shortLabel: "Scheduled",
        headline: `${name} is scheduled to join`,
        detail: "Waiting for the join time, or click Send to Meet now.",
        tone: "neutral",
        progressStep: 1,
        progressTotal: MONITOR_STEPS.length,
      };
    case "joining":
      return {
        shortLabel: "Connecting",
        headline: `${name} is connecting to Google Meet`,
        detail: "Almost there — they should reach the waiting room soon.",
        tone: "active",
        progressStep: 2,
        progressTotal: MONITOR_STEPS.length,
      };
    case "waiting_room":
      return {
        shortLabel: "Waiting room",
        headline: `${name} is in the Google Meet waiting room`,
        detail: "Open Google Meet → People → Waiting to join → Admit.",
        tone: "warning",
        progressStep: 3,
        progressTotal: MONITOR_STEPS.length,
      };
    case "joined":
      return {
        shortLabel: "In call",
        headline: `${name} is in the meeting`,
        detail: "They can hear the call. Type a script below and click Speak now.",
        tone: "success",
        progressStep: 4,
        progressTotal: MONITOR_STEPS.length,
      };
    case "recording":
      return {
        shortLabel: "Live",
        headline: `${name} is live in the meeting`,
        detail: "Recording and listening. Type below to make them speak.",
        tone: "success",
        progressStep: 5,
        progressTotal: MONITOR_STEPS.length,
      };
    case "cancelled":
      return {
        shortLabel: "Left meeting",
        headline: `${name} left the meeting`,
        detail: "Send them to Meet again if you want them back.",
        tone: "neutral",
        progressStep: 0,
        progressTotal: MONITOR_STEPS.length,
      };
    case "failed":
      return {
        shortLabel: "Failed",
        headline: `${name} could not join`,
        detail: "Check the meeting link and try Send to Meet again.",
        tone: "error",
        progressStep: 0,
        progressTotal: MONITOR_STEPS.length,
      };
    case "meeting_ended":
    case "processing":
    case "completed":
      return {
        shortLabel: formatBotStatus(status),
        headline: `Meeting ${status === "completed" ? "completed" : "ended"}`,
        detail: "The bot is no longer in the call.",
        tone: "neutral",
        progressStep: MONITOR_STEPS.length,
        progressTotal: MONITOR_STEPS.length,
      };
    default:
      return {
        shortLabel: formatBotStatus(status),
        headline: formatBotStatus(status),
        detail: "",
        tone: "neutral",
        progressStep: 1,
        progressTotal: MONITOR_STEPS.length,
      };
  }
}

export function botStatusToneClasses(tone: BotStatusTone): {
  panel: string;
  badge: string;
  dot: string;
} {
  switch (tone) {
    case "success":
      return {
        panel: "border-emerald-500/30 bg-emerald-500/5",
        badge: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        dot: "bg-emerald-500",
      };
    case "warning":
      return {
        panel: "border-amber-500/40 bg-amber-500/10",
        badge: "bg-amber-500/15 text-amber-950 dark:text-amber-100",
        dot: "bg-amber-500 animate-pulse",
      };
    case "active":
      return {
        panel: "border-primary/30 bg-primary/5",
        badge: "bg-primary/10 text-primary",
        dot: "bg-primary animate-pulse",
      };
    case "error":
      return {
        panel: "border-destructive/30 bg-destructive/5",
        badge: "bg-destructive/10 text-destructive",
        dot: "bg-destructive",
      };
    default:
      return {
        panel: "border-border bg-muted/20",
        badge: "bg-muted text-muted-foreground",
        dot: "bg-muted-foreground",
      };
  }
}
