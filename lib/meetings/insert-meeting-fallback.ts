import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeetingPlatform } from "@/lib/types/database";

type InsertMeetingParams = {
  userId: string;
  organizationId: string;
  meetingUrl: string;
  externalCalendarId: string;
  title: string;
  platform: MeetingPlatform;
};

function isRetryableInsertError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    /schema cache/i.test(message) ||
    /invalid input value for enum/i.test(message) ||
    /null value in column "provider"/i.test(message) ||
    /null value in column "organization_id"/i.test(message) ||
    /Could not find the 'organization_id' column/i.test(message) ||
    /column ".+" of relation "meetings" does not exist/i.test(message) ||
    /Could not find the 'provider' column/i.test(message)
  );
}

/** Try several row shapes until PostgREST accepts one (works without SQL RPCs). */
export async function insertMeetingWithFallbacks(
  supabase: SupabaseClient,
  params: InsertMeetingParams,
): Promise<string> {
  const now = new Date();
  const ends = new Date(now.getTime() + 60 * 60 * 1000);
  const base = {
    user_id: params.userId,
    organization_id: params.organizationId,
    external_calendar_id: params.externalCalendarId,
    title: params.title,
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
    meeting_url: params.meetingUrl,
  };

  const providerValues = [
    params.platform,
    "google_meet",
    "google",
    "microsoft",
    "zoom",
    "teams",
  ] as const;

  const bodies: Record<string, unknown>[] = [];

  for (const provider of providerValues) {
    bodies.push({ ...base, platform: params.platform, provider });
  }
  bodies.push({ ...base, platform: params.platform });
  bodies.push({ ...base, provider: "google" });
  bodies.push({ ...base, provider: "google_meet" });
  bodies.push({ ...base });

  const minimal = {
    user_id: params.userId,
    organization_id: params.organizationId,
    external_calendar_id: params.externalCalendarId,
    title: params.title,
    starts_at: base.starts_at,
    ends_at: base.ends_at,
    meeting_url: params.meetingUrl,
  };
  bodies.push(minimal);

  bodies.push({
    user_id: params.userId,
    external_calendar_id: params.externalCalendarId,
    title: params.title,
    starts_at: base.starts_at,
    ends_at: base.ends_at,
    meeting_url: params.meetingUrl,
  });

  let lastError: string | undefined;

  for (const body of bodies) {
    const { data, error } = await supabase
      .from("meetings")
      .insert(body)
      .select("id")
      .single();

    if (!error && data?.id) {
      return data.id as string;
    }

    lastError = error?.message;
    if (!isRetryableInsertError(lastError)) {
      break;
    }
  }

  throw new Error(
    lastError ??
      "Could not create meeting row. Run: npm run db:fix (needs SUPABASE_DB_URL in .env.local)",
  );
}

export async function prepareMeetingForJoin(
  supabase: SupabaseClient,
  meetingId: string,
  meetingUrl: string,
  platform: MeetingPlatform,
) {
  const { error: rpcError } = await supabase.rpc("meetmind_prepare_meeting_join", {
    p_meeting_id: meetingId,
    p_meeting_url: meetingUrl,
  });

  if (!rpcError) return;

  const updates: Record<string, unknown>[] = [
    {
      meeting_url: meetingUrl,
      ai_assistant_enabled: true,
      platform,
      updated_at: new Date().toISOString(),
    },
    { meeting_url: meetingUrl, ai_assistant_enabled: true },
    { meeting_url: meetingUrl },
  ];

  for (const patch of updates) {
    const { error } = await supabase
      .from("meetings")
      .update(patch)
      .eq("id", meetingId);
    if (!error) return;
    if (!isRetryableInsertError(error.message)) {
      console.warn("prepareMeetingForJoin:", error.message);
      return;
    }
  }
}
