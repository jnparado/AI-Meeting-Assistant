"use client";

import { useState } from "react";
import { Bot, Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getSupabaseSqlEditorUrl } from "@/lib/supabase/sql-editor-url";

async function readJsonResponse(res: Response): Promise<Record<string, unknown>> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    if (res.status === 401) {
      return { error: "Your session expired. Please sign in again." };
    }
    if (res.status >= 500) {
      return {
        error:
          "Server error — your Mac may be out of disk space. Free space, restart npm run dev, then try again.",
      };
    }
    if (res.status === 404) {
      return {
        error:
          "Join API not found — restart npm run dev (disk full can break the dev server).",
      };
    }
    const snippet = (await res.text()).slice(0, 120);
    return {
      error: snippet
        ? `Unexpected server response (${res.status}). Try refresh or restart dev server.`
        : "Unexpected server response. Try again or refresh the page.",
    };
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: "Could not read server response. Try again." };
  }
}

type Props = {
  initialUrl?: string;
  initialBotName?: string;
  className?: string;
};

export function SimpleAiJoin({
  initialUrl = "",
  initialBotName = "MeetMind AI Notetaker",
  className,
}: Props) {
  const [meetingUrl, setMeetingUrl] = useState(initialUrl);
  const [botName, setBotName] = useState(initialBotName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = meetingUrl.trim();
    const name = botName.trim();
    if (!url || !name) return;

    setLoading(true);
    setMessage(null);
    setIsError(false);

    const res = await fetch("/api/meeting-bots/join-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingUrl: url, botName: name }),
      credentials: "include",
    });

    const data = await readJsonResponse(res);
    setLoading(false);

    if (res.status === 401) {
      setIsError(true);
      setMessage(String(data.error ?? "Please sign in again."));
      window.location.href = `/login?next=${encodeURIComponent("/join")}`;
      return;
    }

    if (!res.ok) {
      setIsError(true);
      setMessage(String(data.error ?? "Could not join the meeting"));
      return;
    }

    const meetingId =
      typeof data.meetingId === "string" ? data.meetingId : undefined;
    const successMessage =
      typeof data.message === "string" ? data.message : undefined;

    if (meetingId) {
      window.location.assign(`/dashboard/meetings/${meetingId}`);
      return;
    }

    setIsError(false);
    setMessage(
      successMessage ??
        "AI is joining. Admit the notetaker from the meeting lobby when prompted.",
    );
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
        <h1 className="text-2xl font-semibold tracking-tight">Join with AI</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Paste a direct Meet link, Meet code (abc-defg-hij), Zoom/Teams URL, or a
          Google Calendar event link (works best after you connect Google Calendar).
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
          placeholder="MeetMind AI Notetaker"
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
            Joining…
          </>
        ) : (
          "Join meeting"
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
