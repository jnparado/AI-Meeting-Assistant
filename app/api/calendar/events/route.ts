import { NextResponse } from "next/server";
import { z } from "zod";
import { createMeetingBotForUser } from "@/lib/bot/create-meeting-bot";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrganization } from "@/lib/org/server";
import { createGoogleMeetInvite } from "@/lib/calendar/create-google-meet-invite";

const createEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timeZone: z.string().trim().min(1).max(120),
  attendeeEmails: z.array(z.string().email()).max(50).default([]),
  sendEmailInvites: z.boolean().optional(),
  scheduleBot: z.boolean().optional(),
  botName: z.string().trim().min(2).max(120).optional(),
});

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { startsAt, endsAt } = parsed.data;
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json(
      { error: "End time must be after start time." },
      { status: 400 },
    );
  }

  try {
    const organization = await requireActiveOrganization(user.id);
    const result = await createGoogleMeetInvite(user.id, organization.id, {
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt,
      endsAt,
      timeZone: parsed.data.timeZone,
      attendeeEmails: parsed.data.attendeeEmails,
      sendEmailInvites: parsed.data.sendEmailInvites,
    });

    let botScheduled = false;
    let botMessage: string | null = null;

    if (parsed.data.scheduleBot) {
      try {
        await createMeetingBotForUser(user.id, organization.id, {
          meetingId: result.meetingId,
          meetingUrl: result.meetingUrl,
          joinAt: startsAt,
          botName: parsed.data.botName,
        });
        botScheduled = true;
        botMessage = parsed.data.botName
          ? `${parsed.data.botName} will join at meeting start.`
          : "AI bot will join at meeting start.";
      } catch (botErr) {
        botMessage =
          botErr instanceof Error
            ? botErr.message
            : "Meet created, but bot scheduling failed.";
      }
    }

    const baseMessage = result.invitesSent
      ? "Google Meet created. Calendar updated and email invites sent."
      : "Google Meet created and added to your calendar.";

    return NextResponse.json({
      ok: true,
      meetingId: result.meetingId,
      meetingUrl: result.meetingUrl,
      googleEventId: result.googleEventId,
      calendarHtmlLink: result.calendarHtmlLink,
      invitesSent: result.invitesSent,
      botScheduled,
      botMessage,
      message: botScheduled
        ? `${baseMessage} ${botMessage ?? ""}`.trim()
        : botMessage
          ? `${baseMessage} ${botMessage}`.trim()
          : baseMessage,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create calendar event";
    const status = /Connect Google Calendar/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
