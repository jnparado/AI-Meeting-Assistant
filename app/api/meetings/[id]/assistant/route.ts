import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/lib/org/server";
import {
  cancelMeetingBotForUser,
  enableAssistantForMeeting,
} from "@/lib/bot/scheduler";
import { SubscriptionError } from "@/lib/bot/credits";

type Body = { enabled: boolean };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;

  try {
    const organization = await requireActiveOrganization(user.id);
    if (body.enabled) {
      const bot = await enableAssistantForMeeting(
        id,
        user.id,
        organization.id,
      );
      return NextResponse.json({ ok: true, bot });
    }
    await cancelMeetingBotForUser(user.id, organization.id, id);
    return NextResponse.json({ ok: true, enabled: false });
  } catch (err) {
    if (err instanceof SubscriptionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
