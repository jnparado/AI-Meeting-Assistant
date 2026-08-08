"use client";

import { useState } from "react";
import { Bot, Link2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setIsError(true);
      setMessage(data.error ?? "Could not join the meeting");
      return;
    }

    setIsError(false);
    setMessage(
      data.message ??
        "AI is joining. Open Google Meet and admit the bot from the waiting room.",
    );
  }

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
          Paste your Meet link and choose the name participants will see.
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
          placeholder="https://meet.google.com/abc-defg-hij"
          autoComplete="off"
          className="h-11 rounded-xl border-border/80 bg-background/90"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bot-name" className="flex items-center gap-2 text-muted-foreground">
          <Bot className="size-3.5" aria-hidden />
          AI name in the call
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
        <p
          className={cn(
            "rounded-xl px-4 py-3 text-center text-sm leading-relaxed",
            isError
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
