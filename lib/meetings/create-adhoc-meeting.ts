import { createServiceClient } from "@/lib/supabase/server";
import { detectMeetingPlatform } from "@/lib/calendar/parse-meeting-url";
import { meetingRowProvider } from "@/lib/meetings/provider";

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
  const platform = detectMeetingPlatform(params.meetingUrl);
  const providerMeet = meetingRowProvider(params.meetingUrl, platform);

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
    if (/meetmind_create_adhoc_meeting|could not find the function/i.test(msg)) {
      throw new Error(
        "Database functions missing. In Supabase SQL Editor, run the file supabase/RUN_IN_SQL_EDITOR.sql, then try Join meeting again.",
      );
    }
    console.warn("createAdhocMeetingRow rpc:", msg);
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
      platform,
      provider: providerMeet,
    },
    {
      user_id: params.userId,
      organization_id: params.organizationId,
      external_calendar_id: params.externalCalendarId,
      title,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      meeting_url: params.meetingUrl,
      platform,
      provider: "google",
    },
    {
      user_id: params.userId,
      organization_id: params.organizationId,
      external_calendar_id: params.externalCalendarId,
      title,
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      meeting_url: params.meetingUrl,
      provider: providerMeet,
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
    if (
      lastError &&
      !/schema cache/i.test(lastError) &&
      !/invalid input value for enum/i.test(lastError)
    ) {
      break;
    }
  }

  throw new Error(
    lastError ??
      "Could not create meeting. Run supabase/migrations/009_meetmind_rpc_provider.sql in Supabase SQL Editor.",
  );
}
