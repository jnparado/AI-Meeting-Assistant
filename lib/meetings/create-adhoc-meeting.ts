import { createServiceClient } from "@/lib/supabase/server";
import { detectMeetingPlatform, meetingTitleForPlatform } from "@/lib/calendar/parse-meeting-url";
import {
  insertMeetingWithFallbacks,
} from "@/lib/meetings/insert-meeting-fallback";

type CreateAdhocParams = {
  userId: string;
  organizationId: string;
  meetingUrl: string;
  externalCalendarId: string;
  title?: string;
};

/** Creates ad-hoc meeting row; prefers DB RPC, then resilient direct inserts. */
export async function createAdhocMeetingRow(
  params: CreateAdhocParams,
): Promise<string> {
  const supabase = createServiceClient();
  const platform = detectMeetingPlatform(params.meetingUrl);
  const title = params.title ?? meetingTitleForPlatform(platform);

  const { data: rpcId, error: rpcError } = await supabase.rpc(
    "meetmind_create_adhoc_meeting",
    {
      p_user_id: params.userId,
      p_organization_id: params.organizationId,
      p_meeting_url: params.meetingUrl,
      p_external_calendar_id: params.externalCalendarId,
      p_title: title,
    },
  );

  if (!rpcError && rpcId) {
    return String(rpcId);
  }

  if (rpcError) {
    const msg = rpcError.message;
    const rpcMissing =
      /meetmind_create_adhoc_meeting|could not find the function/i.test(msg);
    if (!rpcMissing && !/schema cache/i.test(msg)) {
      console.warn("createAdhocMeetingRow rpc:", msg);
    }
  }

  return insertMeetingWithFallbacks(supabase, {
    userId: params.userId,
    organizationId: params.organizationId,
    meetingUrl: params.meetingUrl,
    externalCalendarId: params.externalCalendarId,
    title,
    platform,
  });
}
