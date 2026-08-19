import { Resend } from "resend";
import { isBotSpeaker } from "@/lib/transcripts/filter-bot-speech";
import { createServiceClient } from "@/lib/supabase/server";
import type { TranscriptSegment } from "@/lib/types/database";

export const NO_SHOW_BODY =
  "Failure to attend cannot go to second phase. We will hold your threshold for a month.";

type Attendee = { email?: string; name?: string };

type MeetingRow = {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  attendees: unknown;
  organizer_email: string | null;
  metadata: Record<string, unknown> | null;
  organization_id: string | null;
  user_id: string;
  meeting_bots?: BotRow[] | null;
};

type BotRow = {
  id: string;
  bot_name: string | null;
  status: string;
  joined_at: string | null;
  recording_started_at: string | null;
  created_at: string | null;
};

function graceMinutes(): number {
  const raw = process.env.NO_SHOW_GRACE_MINUTES?.trim();
  const value = raw ? Number(raw) : 15;
  return Number.isFinite(value) && value >= 0 ? value : 15;
}

export function parseAttendees(raw: unknown): Attendee[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is Attendee =>
      typeof row === "object" && row !== null && typeof (row as Attendee).email === "string",
  );
}

export function collectGuestEmails(meeting: {
  attendees: unknown;
  organizer_email?: string | null;
}): string[] {
  const emails = new Set<string>();
  for (const guest of parseAttendees(meeting.attendees)) {
    const email = guest.email?.trim().toLowerCase();
    if (email) emails.add(email);
  }
  const organizer = meeting.organizer_email?.trim().toLowerCase();
  if (organizer) emails.add(organizer);
  return [...emails];
}

export function formatGuestList(attendees: Attendee[]): string {
  if (attendees.length === 0) return "No guest emails on file for this meeting.";
  return attendees
    .map((guest) => {
      const email = guest.email?.trim() ?? "";
      const name = guest.name?.trim();
      if (name && email) return `- ${name} <${email}>`;
      if (email) return `- ${email}`;
      return null;
    })
    .filter(Boolean)
    .join("\n");
}

function formatWhen(meeting: MeetingRow): string {
  const when = meeting.starts_at ?? meeting.ends_at;
  if (!when) return "your scheduled meeting";
  return new Date(when).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function hadGuestParticipation(
  meetingId: string,
  botName: string | null | undefined,
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("segments")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  const segments = (transcript?.segments as TranscriptSegment[] | null) ?? [];
  return segments.some(
    (seg) =>
      seg.text?.trim() &&
      !isBotSpeaker(seg.speaker, botName),
  );
}

function latestBot(bots: BotRow[] | null | undefined): BotRow | null {
  if (!bots?.length) return null;
  return [...bots].sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime(),
  )[0];
}

export async function tryNotifyNoShowForMeeting(
  meetingId: string,
): Promise<"sent" | "skipped" | "failed"> {
  const supabase = createServiceClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "id, title, starts_at, ends_at, attendees, organizer_email, metadata, organization_id, user_id, meeting_bots(id, bot_name, status, joined_at, recording_started_at, created_at)",
    )
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting?.id) return "skipped";

  return notifyNoShowIfEligible(meeting as MeetingRow);
}

async function notifyNoShowIfEligible(
  meeting: MeetingRow,
): Promise<"sent" | "skipped" | "failed"> {
  const metadata = (meeting.metadata as Record<string, unknown> | null) ?? {};
  if (metadata.no_show_notified_at) return "skipped";

  const endsAt = meeting.ends_at ? new Date(meeting.ends_at).getTime() : NaN;
  const graceMs = graceMinutes() * 60 * 1000;
  if (!Number.isFinite(endsAt) || Date.now() < endsAt + graceMs) {
    return "skipped";
  }

  const bot = latestBot(meeting.meeting_bots ?? null);
  if (!bot) return "skipped";

  if (await hadGuestParticipation(meeting.id, bot.bot_name)) {
    return "skipped";
  }

  const attendees = parseAttendees(meeting.attendees);
  const guestEmails = collectGuestEmails(meeting);
  if (guestEmails.length === 0) return "skipped";

  if (!process.env.RESEND_API_KEY?.trim()) {
    await markNoShowResult(meeting.id, metadata, {
      error: "RESEND_API_KEY not configured",
    });
    return "failed";
  }

  const title = meeting.title?.trim() || "AdMob meeting";
  const guestList = formatGuestList(attendees);
  const when = formatWhen(meeting);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "AdMob Meetings <onboarding@resend.dev>",
      to: guestEmails,
      subject: `${title} — attendance required`,
      text: [
        `Hello,`,
        ``,
        `This message is regarding ${title} scheduled for ${when}.`,
        ``,
        `Invited guests:`,
        guestList,
        ``,
        NO_SHOW_BODY,
        ``,
        `If you believe this was sent in error, please reply to this email.`,
      ].join("\n"),
    });

    await markNoShowResult(meeting.id, metadata, {
      notifiedAt: new Date().toISOString(),
      guestEmails,
    });
    return "sent";
  } catch (err) {
    await markNoShowResult(meeting.id, metadata, {
      error: err instanceof Error ? err.message : "Email send failed",
    });
    return "failed";
  }
}

async function markNoShowResult(
  meetingId: string,
  metadata: Record<string, unknown>,
  result: { notifiedAt?: string; guestEmails?: string[]; error?: string },
) {
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { ...metadata };
  if (result.notifiedAt) {
    patch.no_show_notified_at = result.notifiedAt;
    patch.no_show_guest_emails = result.guestEmails ?? [];
  }
  if (result.error) {
    patch.no_show_last_error = result.error;
    patch.no_show_last_attempt_at = new Date().toISOString();
  }
  await supabase
    .from("meetings")
    .update({ metadata: patch })
    .eq("id", meetingId);
}

export async function processNoShowMeetings(limit = 30): Promise<{
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - graceMinutes() * 60 * 1000).toISOString();

  const { data: meetings } = await supabase
    .from("meetings")
    .select(
      "id, title, starts_at, ends_at, attendees, organizer_email, metadata, organization_id, user_id, meeting_bots(id, bot_name, status, joined_at, recording_started_at, created_at)",
    )
    .eq("ai_assistant_enabled", true)
    .lt("ends_at", cutoff)
    .order("ends_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of meetings ?? []) {
    const result = await notifyNoShowIfEligible(row as MeetingRow);
    if (result === "sent") sent += 1;
    else if (result === "failed") failed += 1;
    else skipped += 1;
  }

  return {
    checked: meetings?.length ?? 0,
    sent,
    skipped,
    failed,
  };
}
