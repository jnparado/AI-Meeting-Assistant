"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJsonResponse } from "@/lib/client/read-json-response";
import { formatFetchError } from "@/lib/client/format-fetch-error";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";

type Props = {
  meetingId: string;
  meetingUrl: string | null;
  enabled: boolean;
  initialBotName?: string;
  voiceAgentEnabled?: boolean;
};

export function AssistantToggle({
  meetingId,
  meetingUrl: initialUrl,
  enabled,
  initialBotName,
  voiceAgentEnabled = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);
  const [meetingUrl, setMeetingUrl] = useState(initialUrl ?? "");
  const [botName, setBotName] = useState(
    initialBotName?.trim() || DEFAULT_BOT_NAME,
  );
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);

  const displayName = botName.trim() || DEFAULT_BOT_NAME;

  async function schedule() {
    const url = meetingUrl.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    setResolvedHint(null);

    try {
      const res = await fetch("/api/meeting-bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingId,
          meetingUrl: url,
          botName: displayName,
        }),
      });
      const data = await readJsonResponse(res);
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
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meeting-bots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ meetingId }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) {
        setError(String(data.error ?? "Could not cancel assistant"));
        return;
      }
      setOn(false);
      router.refresh();
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendBotNow() {
    const url = meetingUrl.trim();
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/meeting-bots/join-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          meetingUrl: url,
          meetingId,
          botName: displayName,
        }),
      });

      const data = await readJsonResponse(res);

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
        joined: data.alreadyActive === true ? "existing" : "1",
        bot: displayName,
        mode: provider,
      });
      window.location.assign(`/dashboard/meetings/${meetingId}?${params}`);
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (on) await cancel();
    else await schedule();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="space-y-2">
        <Label
          htmlFor={`bot-name-${meetingId}`}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Bot className="size-3.5" aria-hidden />
          Bot name in Google Meet
        </Label>
        <Input
          id={`bot-name-${meetingId}`}
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder={DEFAULT_BOT_NAME}
          className="rounded-xl text-sm"
          disabled={loading}
        />
      </div>

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
            className="rounded-xl text-sm"
            disabled={loading}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Sends <strong className="font-medium text-foreground">{displayName}</strong>{" "}
        into the call — admit them from the Meet waiting room if you host.
        {voiceAgentEnabled ? (
          <>
            {" "}
            <strong className="font-medium text-foreground">{displayName}</strong>{" "}
            will introduce himself by voice once admitted.
          </>
        ) : null}
      </p>

      <Button
        onClick={toggle}
        disabled={loading || (!meetingUrl.trim() && !on)}
        variant={on ? "default" : "outline"}
        className="rounded-full"
      >
        {loading
          ? "Updating…"
          : on
            ? "AI assistant scheduled"
            : "Schedule AI assistant"}
      </Button>

      {meetingUrl.trim() && (
        <Button
          type="button"
          variant={on ? "secondary" : "default"}
          disabled={loading || !displayName}
          onClick={sendBotNow}
          className="rounded-full"
        >
          {loading
            ? "Sending bot…"
            : on
              ? `Send ${displayName} to Meet again`
              : `Send ${displayName} to Meet now`}
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
