"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  meetingId: string;
  meetingUrl: string | null;
  enabled: boolean;
  botName?: string;
};

export function AssistantToggle({
  meetingId,
  meetingUrl,
  enabled,
  botName,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);

  async function schedule() {
    if (!meetingUrl) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/meeting-bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId,
        meetingUrl,
        ...(botName ? { botName } : {}),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not schedule assistant");
      return;
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
    <div className="flex flex-col gap-2">
      <Button
        onClick={toggle}
        disabled={loading || (!meetingUrl && !on)}
        variant={on ? "default" : "outline"}
      >
        {loading
          ? "Updating…"
          : on
            ? "AI assistant scheduled"
            : "Send AI assistant"}
      </Button>
      {!meetingUrl && (
        <p className="text-xs text-muted-foreground">
          Add a Google Meet, Zoom, or Teams link to this calendar event.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
