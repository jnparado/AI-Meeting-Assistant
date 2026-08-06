export type CalendarProvider = "google" | "microsoft";
export type MeetingPlatform = "google_meet" | "zoom" | "teams" | "unknown";
export type BotStatus =
  | "scheduled"
  | "joining"
  | "waiting_room"
  | "joined"
  | "recording"
  | "meeting_ended"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ActionItem = {
  task: string;
  owner?: string;
  due?: string;
};

export type TranscriptSegment = {
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
};

export type MeetingRow = {
  id: string;
  user_id: string;
  external_calendar_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  meeting_url: string | null;
  platform: MeetingPlatform;
  ai_assistant_enabled: boolean;
};

export type MeetingSummaryRow = {
  id: string;
  meeting_id: string;
  summary: string;
  decisions: string[];
  action_items: ActionItem[];
  key_topics: string[];
};
