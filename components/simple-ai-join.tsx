"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialUrl?: string;
  initialBotName?: string;
};

export function SimpleAiJoin({
  initialUrl = "",
  initialBotName = "MeetMind AI Notetaker",
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
      className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm"
    >
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Join with AI</h1>
        <p className="text-sm text-muted-foreground">
          Paste your Meet link and the name shown in the call.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meeting-url">Meeting link</Label>
        <Input
          id="meeting-url"
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://meet.google.com/abc-defg-hij"
          autoComplete="off"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bot-name">AI name</Label>
        <Input
          id="bot-name"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder="MeetMind AI Notetaker"
          required
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Joining…" : "Join meeting"}
      </Button>

      {message && (
        <p
          className={`text-center text-sm ${isError ? "text-destructive" : "text-primary"}`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
