import { createServiceClient } from "@/lib/supabase/server";

export type MeetingRow = Record<string, unknown> & {
  id: string;
  user_id?: string;
  organization_id?: string | null;
  title?: string;
  starts_at?: string;
  meeting_url?: string | null;
  platform?: string;
  ai_assistant_enabled?: boolean;
};

/** Backfill organization_id / user_id after resilient inserts (service role). */
export async function ensureMeetingOrganization(
  meetingId: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from("meetings")
    .select("id, organization_id, user_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (error || !row) return;

  const patch: Record<string, string> = {};
  if (!row.organization_id) patch.organization_id = organizationId;
  if (!row.user_id) patch.user_id = userId;

  if (Object.keys(patch).length === 0) return;

  await supabase.from("meetings").update(patch).eq("id", meetingId);
}

async function isOrgMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Load meeting by id using service role, then verify the signed-in user may view it.
 * Avoids RLS / missing organization_id issues after ad-hoc join.
 */
export async function loadMeetingForUserSecure(
  meetingId: string,
  userId: string,
  organizationId: string | null,
): Promise<MeetingRow | null> {
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (error || !row) return null;

  const meeting = row as MeetingRow;

  if (meeting.user_id === userId) {
    if (!meeting.organization_id && organizationId) {
      await ensureMeetingOrganization(meetingId, organizationId, userId);
      meeting.organization_id = organizationId;
    }
    return meeting;
  }

  const orgToCheck = meeting.organization_id ?? organizationId;
  if (orgToCheck && (await isOrgMember(userId, orgToCheck))) {
    if (!meeting.user_id) {
      await ensureMeetingOrganization(meetingId, orgToCheck, userId);
      meeting.user_id = userId;
    }
    if (!meeting.organization_id) {
      meeting.organization_id = orgToCheck;
    }
    return meeting;
  }

  if (!meeting.user_id && organizationId) {
    await ensureMeetingOrganization(meetingId, organizationId, userId);
    return {
      ...meeting,
      user_id: userId,
      organization_id: organizationId,
    };
  }

  return null;
}
