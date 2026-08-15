"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ExternalLink, Loader2, Mail, Video } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { readJsonResponse } from "@/lib/client/read-json-response";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";

type Props = {
  hasGoogleCalendar: boolean;
  className?: string;
};

function defaultStartLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function defaultEndLocal(startLocal: string): string {
  const d = new Date(startLocal);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function parseAttendeeEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\n]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function ScheduleMeetInvite({ hasGoogleCalendar, className }: Props) {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState(defaultStartLocal);
  const [endsAtLocal, setEndsAtLocal] = useState(() =>
    defaultEndLocal(defaultStartLocal()),
  );
  const [attendees, setAttendees] = useState("");
  const [sendEmailInvites, setSendEmailInvites] = useState(true);
  const [scheduleBot, setScheduleBot] = useState(true);
  const [botName, setBotName] = useState(DEFAULT_BOT_NAME);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState<{
    meetingId?: string;
    meetingUrl?: string;
    calendarHtmlLink?: string | null;
  } | null>(null);

  function onStartChange(value: string) {
    setStartsAtLocal(value);
    const start = new Date(value);
    const end = new Date(endsAtLocal);
    if (!Number.isNaN(start.getTime()) && end <= start) {
      setEndsAtLocal(defaultEndLocal(value));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasGoogleCalendar) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setLoading(true);
    setMessage(null);
    setIsError(false);
    setResult(null);

    const startsAt = new Date(startsAtLocal);
    const endsAt = new Date(endsAtLocal);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setLoading(false);
      setIsError(true);
      setMessage("Enter valid start and end times.");
      return;
    }

    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: trimmedTitle,
        description: description.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timeZone,
        attendeeEmails: parseAttendeeEmails(attendees),
        sendEmailInvites,
        scheduleBot,
        botName: botName.trim() || undefined,
      }),
    });

    const data = await readJsonResponse(res);
    setLoading(false);

    if (res.status === 401) {
      setIsError(true);
      setMessage(String(data.error ?? "Please sign in again."));
      window.location.href = `/login?next=${encodeURIComponent("/dashboard/schedule")}`;
      return;
    }

    if (!res.ok) {
      setIsError(true);
      setMessage(String(data.error ?? "Could not create meeting invite"));
      return;
    }

    const meetingId =
      typeof data.meetingId === "string" ? data.meetingId : undefined;
    const meetingUrl =
      typeof data.meetingUrl === "string" ? data.meetingUrl : undefined;
    const calendarHtmlLink =
      typeof data.calendarHtmlLink === "string" ? data.calendarHtmlLink : null;

    setResult({ meetingId, meetingUrl, calendarHtmlLink });
    setIsError(false);
    setMessage(
      typeof data.message === "string"
        ? data.message
        : "Google Meet invitation created.",
    );
  }

  if (!hasGoogleCalendar) {
    return (
      <div
        className={cn(
          "glass-panel mx-auto w-full max-w-lg space-y-4 rounded-3xl p-8 text-center",
          className,
        )}
      >
        <CalendarPlus className="mx-auto size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Connect Google Calendar first</h2>
        <p className="text-sm text-muted-foreground">
          Scheduling creates a Google Calendar event with a Meet link and sends
          email invites to guests.
        </p>
        <Link
          href="/api/oauth/google?returnTo=/dashboard/schedule"
          prefetch={false}
          className={cn(buttonVariants(), "inline-flex")}
        >
          Connect Google Calendar
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "glass-panel mx-auto w-full max-w-lg space-y-6 rounded-3xl p-8 md:p-10",
        className,
      )}
    >
      <div className="space-y-2 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarPlus className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule Google Meet</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Creates a calendar event with a Meet link, emails guests, and shows it
          in your MeetMind dashboard.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meet-title">Title</Label>
        <Input
          id="meet-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Weekly sync"
          className="h-11 rounded-xl"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meet-description">Description (optional)</Label>
        <textarea
          id="meet-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Agenda, notes for guests…"
          rows={3}
          className="border-input bg-background/90 placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-xl border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="meet-start">Starts</Label>
          <Input
            id="meet-start"
            type="datetime-local"
            value={startsAtLocal}
            onChange={(e) => onStartChange(e.target.value)}
            className="h-11 rounded-xl"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meet-end">Ends</Label>
          <Input
            id="meet-end"
            type="datetime-local"
            value={endsAtLocal}
            onChange={(e) => setEndsAtLocal(e.target.value)}
            className="h-11 rounded-xl"
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Timezone: {timeZone}</p>

      <div className="space-y-2">
        <Label htmlFor="meet-attendees" className="flex items-center gap-2">
          <Mail className="size-3.5" aria-hidden />
          Guest emails
        </Label>
        <textarea
          id="meet-attendees"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          placeholder="alice@company.com, bob@company.com"
          rows={2}
          className="border-input bg-background/90 placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[60px] w-full rounded-xl border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={sendEmailInvites}
          onChange={(e) => setSendEmailInvites(e.target.checked)}
          className="mt-1"
        />
        <span>
          Send email invites via Google Calendar
          {parseAttendeeEmails(attendees).length === 0
            ? " (add guest emails above)"
            : ""}
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={scheduleBot}
          onChange={(e) => setScheduleBot(e.target.checked)}
          className="mt-1"
        />
        <span>Schedule AI bot to join at meeting start</span>
      </label>

      {scheduleBot && (
        <div className="space-y-2">
          <Label htmlFor="meet-bot-name">Bot name in the call</Label>
          <Input
            id="meet-bot-name"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder={DEFAULT_BOT_NAME}
            className="h-11 rounded-xl"
          />
        </div>
      )}

      <Button
        type="submit"
        className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20"
        size="lg"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating invite…
          </>
        ) : (
          "Create Meet & send invites"
        )}
      </Button>

      {message && (
        <div
          className={cn(
            "space-y-3 rounded-xl px-4 py-3 text-sm leading-relaxed",
            isError
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
          role={isError ? "alert" : "status"}
        >
          <p>{message}</p>
          {!isError && result?.meetingUrl && (
            <div className="flex flex-col gap-2 pt-1">
              <a
                href={result.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "inline-flex w-full justify-center gap-2",
                )}
              >
                <Video className="size-4" aria-hidden />
                Open Meet link
              </a>
              {result.calendarHtmlLink && (
                <a
                  href={result.calendarHtmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex w-full justify-center gap-2",
                  )}
                >
                  <ExternalLink className="size-4" aria-hidden />
                  View in Google Calendar
                </a>
              )}
              {result.meetingId && (
                <Link
                  href={`/dashboard/meetings/${result.meetingId}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "inline-flex w-full justify-center",
                  )}
                >
                  Open in MeetMind dashboard
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
