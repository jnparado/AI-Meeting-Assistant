import { normalizeMeetingUrl } from "@/lib/calendar/parse-meeting-url";
import { createServiceClient } from "@/lib/supabase/server";

const ACTIVE_BOT_STATUSES = [
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
] as const;

type MeetingBotRow = {
  id: string;
  meeting_id: string;
  bot_name: string | null;
  status: string;
  external_bot_id: string | null;
  scheduled_for: string | null;
  created_at: string | null;
};

export async function findActiveBotForMeetingUrl(
  organizationId: string,
  userId: string,
  meetingUrl: string,
): Promise<MeetingBotRow | null> {
  const supabase = createServiceClient();
  const normalized = normalizeMeetingUrl(meetingUrl);
  const meetCode = normalized.match(
    /meet\.google\.com\/([a-z0-9-]+)/i,
  )?.[1];

  let meetingsQuery = supabase
    .from("meetings")
    .select("id, meeting_url")
    .eq("organization_id", organizationId);

  if (meetCode) {
    meetingsQuery = meetingsQuery.ilike("meeting_url", `%${meetCode}%`);
  } else {
    meetingsQuery = meetingsQuery.eq("meeting_url", meetingUrl);
  }

  const { data: meetings } = await meetingsQuery
    .order("created_at", { ascending: false })
    .limit(20);

  const meetingIds = (meetings ?? [])
    .filter(
      (m) =>
        m.meeting_url &&
        normalizeMeetingUrl(String(m.meeting_url)) === normalized,
    )
    .map((m) => m.id as string);

  if (!meetingIds.length) return null;

  const { data: bots } = await supabase
    .from("meeting_bots")
    .select(
      "id, meeting_id, bot_name, status, external_bot_id, scheduled_for, created_at",
    )
    .in("meeting_id", meetingIds)
    .eq("user_id", userId)
    .in("status", [...ACTIVE_BOT_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1);

  return (bots?.[0] as MeetingBotRow | undefined) ?? null;
}
