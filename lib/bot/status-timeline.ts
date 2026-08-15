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
