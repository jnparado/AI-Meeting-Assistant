import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/lib/org/server";
import {
  createMeetingBotForUser,
  SubscriptionError,
} from "@/lib/bot/create-meeting-bot";
import { createMeetingBotSchema } from "@/lib/bot/validate-meeting-url";
import { cancelMeetingBotForUser } from "@/lib/bot/cancel-meeting-bot";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createMeetingBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const organization = await requireActiveOrganization(user.id);
    const result = await createMeetingBotForUser(
      user.id,
      organization.id,
      {
        ...parsed.data,
        joinNow: parsed.data.joinNow ?? false,
      },
    );

    return NextResponse.json({
      ok: true,
      bot: result.bot,
      botName: result.botName,
      joinAt: result.joinAt,
      externalBotId: result.bot.external_bot_id,
      resolvedMeetingUrl: result.resolvedMeetingUrl,
    });
  } catch (err) {
    if (err instanceof SubscriptionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : "Failed to schedule bot";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const cancelSchema = z.object({
  meetingId: z.string().uuid(),
  meetingUrl: z.string().min(8).max(2048).optional(),
});

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }

  try {
    const organization = await requireActiveOrganization(user.id);
    const result = await cancelMeetingBotForUser(
      user.id,
      organization.id,
      parsed.data.meetingId,
      parsed.data.meetingUrl,
    );
    return NextResponse.json({
      ok: true,
      enabled: false,
      removedFromRecall: result.removedFromRecall,
      cancelledInDb: result.cancelledInDb,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
