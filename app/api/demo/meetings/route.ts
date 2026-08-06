import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/lib/org/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organization = await requireActiveOrganization(user.id);
  const now = Date.now();
  const demos = [
    {
      external_calendar_id: `demo:standup-${organization.id}`,
      title: "Product Planning",
      meeting_url: "https://meet.google.com/abc-defg-hij",
      platform: "google_meet" as const,
      offsetHours: 24,
    },
    {
      external_calendar_id: `demo:zoom-${organization.id}`,
      title: "Customer discovery",
      meeting_url: "https://zoom.us/j/1234567890",
      platform: "zoom" as const,
      offsetHours: 48,
    },
    {
      external_calendar_id: `demo:teams-${organization.id}`,
      title: "Quarterly planning",
      meeting_url: "https://teams.microsoft.com/l/meetup-join/demo",
      platform: "teams" as const,
      offsetHours: 72,
    },
  ];

  for (const demo of demos) {
    const starts = new Date(now + demo.offsetHours * 60 * 60 * 1000);
    const ends = new Date(starts.getTime() + 45 * 60 * 1000);
    await supabase.from("meetings").upsert(
      {
        user_id: user.id,
        organization_id: organization.id,
        external_calendar_id: demo.external_calendar_id,
        title: demo.title,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        meeting_url: demo.meeting_url,
        platform: demo.platform,
        description: "Demo calendar event",
        attendees: [],
      },
      { onConflict: "organization_id,external_calendar_id" },
    );
  }

  return NextResponse.json({ ok: true, count: demos.length });
}
