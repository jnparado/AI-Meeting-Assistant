"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJsonResponse } from "@/lib/client/read-json-response";

type Props = {
  meetingId: string;
  meetingUrl: string | null;
  enabled: boolean;
  botName?: string;
};

export function AssistantToggle({
  meetingId,
  meetingUrl: initialUrl,
  enabled,
  botName = "MeetMind AI Notetaker",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);
  const [meetingUrl, setMeetingUrl] = useState(initialUrl ?? "");
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);

  async function schedule() {
    const url = meetingUrl.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    setResolvedHint(null);

    const res = await fetch("/api/meeting-bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        meetingId,
        meetingUrl: url,
        botName,
      }),
    });
    const data = await readJsonResponse(res);
    setLoading(false);
    if (!res.ok) {
      setError(String(data.error ?? "Could not schedule assistant"));
      return;
    }
    const resolved =
      typeof data.resolvedMeetingUrl === "string"
        ? data.resolvedMeetingUrl
        : null;
    if (resolved && resolved !== url) {
      setResolvedHint(`Using Meet link: ${resolved}`);
      setMeetingUrl(resolved);
    }
    setOn(true);
    router.refresh();
  }

  async function cancel() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/meeting-bots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ meetingId }),
    });
    const data = await readJsonResponse(res);
    setLoading(false);
    if (!res.ok) {
      setError(String(data.error ?? "Could not cancel assistant"));
      return;
    }
    setOn(false);
    router.refresh();
  }

  async function sendBotNow() {
    const url = meetingUrl.trim();
    if (!url) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/meeting-bots/join-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        meetingUrl: url,
        meetingId,
        botName,
      }),
    });

    const data = await readJsonResponse(res);
    setLoading(false);

    if (res.status === 401) {
      setError(String(data.error ?? "Please sign in again."));
      window.location.href = `/login?next=${encodeURIComponent(`/dashboard/meetings/${meetingId}`)}`;
      return;
    }

    if (!res.ok) {
      setError(String(data.error ?? "Could not send AI bot"));
      return;
    }

    setOn(true);
    const provider =
      typeof data.provider === "string" ? data.provider : "simulation";
    const params = new URLSearchParams({
      joined: "1",
      bot: botName,
      mode: provider,
    });
    window.location.assign(`/dashboard/meetings/${meetingId}?${params}`);
  }

  async function toggle() {
    if (on) await cancel();
    else await schedule();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {!on && (
        <div className="space-y-2">
          <Label htmlFor={`meet-url-${meetingId}`} className="text-xs">
            Meeting link
          </Label>
          <Input
            id={`meet-url-${meetingId}`}
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="meet.google.com/… or calendar.app.google/…"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Sends <strong className="font-medium text-foreground">{botName}</strong>{" "}
            into the call — you do not join as yourself. Admit the bot from the
            Meet waiting room if you host.
          </p>
        </div>
      )}
      <Button
        onClick={toggle}
        disabled={loading || (!meetingUrl.trim() && !on)}
        variant={on ? "default" : "outline"}
      >
        {loading
          ? "Updating…"
          : on
            ? "AI assistant scheduled"
            : "Schedule AI assistant"}
      </Button>
      {!on && meetingUrl.trim() && (
        <Button
          type="button"
          variant="default"
          disabled={loading}
          onClick={sendBotNow}
        >
          {loading ? "Sending bot…" : "Send AI to join now"}
        </Button>
      )}
      {resolvedHint && (
        <p className="text-xs text-primary">{resolvedHint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
