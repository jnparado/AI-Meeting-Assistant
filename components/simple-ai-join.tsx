"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getSupabaseSqlEditorUrl } from "@/lib/supabase/sql-editor-url";
import { readJsonResponse } from "@/lib/client/read-json-response";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";

type Props = {
  initialUrl?: string;
  initialBotName?: string;
  /** When true and initialUrl is set, join immediately without clicking Send. */
  autoJoin?: boolean;
  className?: string;
};

export function SimpleAiJoin({
  initialUrl = "",
  initialBotName = DEFAULT_BOT_NAME,
  autoJoin = false,
  className,
}: Props) {
  const [meetingUrl, setMeetingUrl] = useState(initialUrl);
  const [botName, setBotName] = useState(initialBotName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const autoJoinStarted = useRef(false);

  async function joinMeeting(url: string, name: string) {
    const trimmedUrl = url.trim();
    const trimmedName = name.trim();
    if (!trimmedUrl || !trimmedName) return;

    setLoading(true);
    setMessage(null);
    setIsError(false);

    const res = await fetch("/api/meeting-bots/join-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingUrl: trimmedUrl, botName: trimmedName }),
      credentials: "include",
    });

    const data = await readJsonResponse(res);
    setLoading(false);

    if (res.status === 401) {
      setIsError(true);
      setMessage(String(data.error ?? "Please sign in again."));
      const next = `/join?url=${encodeURIComponent(trimmedUrl)}&auto=1`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }

    if (!res.ok) {
      setIsError(true);
      setMessage(String(data.error ?? "Could not join the meeting"));
      return;
    }

    const meetingId =
      typeof data.meetingId === "string" ? data.meetingId : undefined;
    const provider =
      typeof data.provider === "string" ? data.provider : "simulation";
    const alreadyActive = data.alreadyActive === true;

    if (meetingId) {
      const params = new URLSearchParams({
        joined: alreadyActive ? "existing" : "1",
        bot: trimmedName,
        mode: provider,
      });
      window.location.assign(`/dashboard/meetings/${meetingId}?${params}`);
      return;
    }

    setIsError(false);
    setMessage(
      typeof data.message === "string"
        ? data.message
        : `“${trimmedName}” is joining the meeting. Admit the bot from the lobby if you’re the host.`,
    );
  }

  useEffect(() => {
    if (!autoJoin || !initialUrl.trim() || autoJoinStarted.current) return;
    autoJoinStarted.current = true;
    void joinMeeting(initialUrl, initialBotName);
  }, [autoJoin, initialUrl, initialBotName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await joinMeeting(meetingUrl, botName);
  }

  const sqlEditorUrl = getSupabaseSqlEditorUrl();

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "glass-panel mx-auto w-full max-w-md space-y-7 rounded-3xl p-8 md:p-10",
        className,
      )}
    >
      <div className="space-y-2 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Send AI to meeting</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Paste a Meet link. MeetMind sends an AI notetaker into the call —{" "}
          <strong className="font-medium text-foreground">you do not join</strong>{" "}
          as yourself. If you host the meeting, admit{" "}
          <strong className="font-medium text-foreground">{botName.trim() || DEFAULT_BOT_NAME}</strong>{" "}
          from the waiting room.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting-url" className="flex items-center gap-2 text-muted-foreground">
          <Link2 className="size-3.5" aria-hidden />
          Meeting link
        </Label>
        <Input
          id="meeting-url"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij or calendar event link"
          autoComplete="off"
          className="h-11 rounded-xl border-border/80 bg-background/90"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bot-name" className="flex items-center gap-2 text-muted-foreground">
          <Bot className="size-3.5" aria-hidden />
          Bot name in the call
        </Label>
        <Input
          id="bot-name"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder={DEFAULT_BOT_NAME}
          className="h-11 rounded-xl border-border/80 bg-background/90"
          required
        />
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-xl text-base shadow-lg shadow-primary/20"
        size="lg"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Joining bot…
          </>
        ) : (
          "Send AI bot"
        )}
      </Button>

      {message && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-center text-sm leading-relaxed",
            isError
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
          role={isError ? "alert" : "status"}
        >
          <p>{message}</p>
          {isError &&
            /RUN_IN_SQL_EDITOR|PATCH_meeting_bots|one-time SQL fix/i.test(
              message,
            ) &&
            (sqlEditorUrl ? (
              <p className="mt-2">
                <a
                  href={sqlEditorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  Open Supabase SQL Editor
                </a>
                {" · "}
                paste{" "}
                <code className="text-xs">supabase/PATCH_meeting_bots.sql</code>{" "}
                (or the full RUN_IN_SQL_EDITOR.sql) and Run
              </p>
            ) : null)}
        </div>
      )}
    </form>
  );
}
