import { normalizeMeetingUrl } from "@/lib/calendar/parse-meeting-url";
import { createServiceClient } from "@/lib/supabase/server";

export async function findMeetingIdByUrl(
  organizationId: string,
  meetingUrl: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const normalized = normalizeMeetingUrl(meetingUrl);
  const meetCode = normalized.match(
    /meet\.google\.com\/([a-z0-9-]+)/i,
  )?.[1];

  let query = supabase
    .from("meetings")
    .select("id, meeting_url")
    .eq("organization_id", organizationId);

  if (meetCode) {
    query = query.ilike("meeting_url", `%${meetCode}%`);
  } else {
    query = query.eq("meeting_url", meetingUrl);
  }

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(20);

  for (const row of data ?? []) {
    if (
      row.meeting_url &&
      normalizeMeetingUrl(String(row.meeting_url)) === normalized
    ) {
      return row.id as string;
    }
  }

  return null;
}
