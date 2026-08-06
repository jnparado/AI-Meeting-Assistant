"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  botName,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);
  const [meetingUrl, setMeetingUrl] = useState(initialUrl ?? "");
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function schedule() {
    const url = meetingUrl.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    setResolvedHint(null);

    const res = await fetch("/api/meeting-bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId,
        meetingUrl: url,
        ...(botName ? { botName } : {}),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not schedule assistant");
      return;
    }
    if (data.resolvedMeetingUrl && data.resolvedMeetingUrl !== url) {
      setResolvedHint(`Using Meet link: ${data.resolvedMeetingUrl}`);
      setMeetingUrl(data.resolvedMeetingUrl);
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
      body: JSON.stringify({ meetingId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not cancel assistant");
      return;
    }
    setOn(false);
    router.refresh();
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
            Paste a direct Google Meet URL or a Google Calendar event link — we
            resolve Calendar pages to the Meet join URL before the bot joins.
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
          onClick={async () => {
            setLoading(true);
            setError(null);
            const res = await fetch("/api/meeting-bots/join-now", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meetingUrl: meetingUrl.trim(),
                meetingId,
                ...(botName ? { botName } : {}),
              }),
            });
            const data = await res.json();
            setLoading(false);
            if (!res.ok) {
              setError(data.error ?? "Join failed");
              return;
            }
            setOn(true);
            setSuccess(data.message);
            router.push(`/dashboard/meetings/${data.meetingId ?? meetingId}`);
            router.refresh();
          }}
        >
          Send AI to join now
        </Button>
      )}
      {resolvedHint && (
        <p className="text-xs text-primary">{resolvedHint}</p>
      )}
      {success && <p className="text-xs text-primary">{success}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
