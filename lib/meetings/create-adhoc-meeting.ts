import { createServiceClient } from "@/lib/supabase/server";

type CreateAdhocParams = {
  userId: string;
  organizationId: string;
  meetingUrl: string;
  externalCalendarId: string;
  title?: string;
};

/** Creates ad-hoc meeting row; prefers DB RPC to avoid PostgREST schema cache issues. */
export async function createAdhocMeetingRow(
  params: CreateAdhocParams,
): Promise<string> {
  const supabase = createServiceClient();
  const title = params.title ?? "Live Google Meet";

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

  if (rpcError && !/meetmind_create_adhoc_meeting/i.test(rpcError.message)) {
    console.warn("createAdhocMeetingRow rpc:", rpcError.message);
  }

  const now = new Date();
  const ends = new Date(now.getTime() + 60 * 60 * 1000);
  const payloads: Record<string, string>[] = [
    {
      user_id: params.userId,
      organization_id: params.organizationId,
      external_calendar_id: params.externalCalendarId,
      title,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      meeting_url: params.meetingUrl,
    },
    {
      user_id: params.userId,
      organization_id: params.organizationId,
      external_calendar_id: params.externalCalendarId,
      title,
      meeting_url: params.meetingUrl,
    },
  ];

  let lastError: string | undefined;
  for (const body of payloads) {
    const { data, error } = await supabase
      .from("meetings")
      .insert(body)
      .select("id")
      .single();

    if (!error && data?.id) {
      return data.id as string;
    }
    lastError = error?.message;
    if (!lastError?.includes("schema cache")) {
      break;
    }
  }

  throw new Error(
    lastError ??
      "Could not create meeting. Run supabase/fix_join_flow.sql in Supabase SQL Editor.",
  );
}
