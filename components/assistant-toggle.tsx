"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJsonResponse } from "@/lib/client/read-json-response";
import { formatFetchError } from "@/lib/client/format-fetch-error";
import { stopMeetingBot } from "@/lib/bot/stop-meeting-bot-client";
import { DEFAULT_BOT_NAME } from "@/lib/bot/default-bot-name";
import type { BotStatus } from "@/lib/types/database";

const IN_MEETING_STATUSES = new Set<BotStatus>([
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

const LEAVABLE_STATUSES = new Set<BotStatus>([
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

type Props = {
  meetingId: string;
  meetingUrl: string | null;
  enabled: boolean;
  initialBotName?: string;
  voiceAgentEnabled?: boolean;
  botStatus?: BotStatus | null;
  hasScheduledBot?: boolean;
  compact?: boolean;
  hideLeave?: boolean;
  onBotSent?: () => void;
};

export function AssistantToggle({
  meetingId,
  meetingUrl: initialUrl,
  enabled,
  initialBotName,
  voiceAgentEnabled = false,
  botStatus = null,
  hasScheduledBot = false,
  compact = false,
  hideLeave = false,
  onBotSent,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [on, setOn] = useState(enabled);
  const [liveBotStatus, setLiveBotStatus] = useState<BotStatus | null>(
    botStatus,
  );
  const [meetingUrl, setMeetingUrl] = useState(initialUrl ?? "");
  const [botName, setBotName] = useState(
    initialBotName?.trim() || DEFAULT_BOT_NAME,
  );
  const [resolvedHint, setResolvedHint] = useState<string | null>(null);

  const displayName = botName.trim() || DEFAULT_BOT_NAME;

  useEffect(() => {
    setOn(enabled);
  }, [enabled]);

  useEffect(() => {
    setLiveBotStatus(botStatus);
  }, [botStatus]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/live`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          botStatus?: BotStatus | null;
          hasBot?: boolean;
        };
        if (cancelled) return;
        if (data.botStatus) setLiveBotStatus(data.botStatus);
        if (data.hasBot) setOn(true);
      } catch {
        /* ignore */
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [meetingId]);

  async function leaveMeeting() {
    const inCall = liveBotStatus
      ? IN_MEETING_STATUSES.has(liveBotStatus)
      : on;
    const message = inCall
      ? `Stop ${displayName} and remove them from the meeting now?`
      : `Cancel the scheduled assistant for this meeting?`;
    if (!window.confirm(message)) return;
    await cancel();
  }

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
      onBotSent?.();
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
      const result = await stopMeetingBot(meetingId, meetingUrl.trim() || undefined);
      if (!result.ok) {
        setError(result.error ?? "Could not stop the bot");
        return;
      }
      setOn(false);
      window.location.assign(`/dashboard/meetings/${meetingId}`);
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
      onBotSent?.();
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

  const canLeave =
    hasScheduledBot ||
    on ||
    (liveBotStatus ? LEAVABLE_STATUSES.has(liveBotStatus) : false);

  return (
    <div
      className={
        compact
          ? "flex w-full flex-col gap-3"
          : "flex w-full max-w-sm flex-col gap-3"
      }
    >
      {canLeave && !hideLeave && (
        <Button
          type="button"
          variant="destructive"
          disabled={loading}
          onClick={() => void leaveMeeting()}
          className="rounded-full gap-2"
        >
          {loading ? (
            "Leaving…"
          ) : (
            <>
              <Square className="size-3.5 fill-current" aria-hidden />
              Leave meeting
            </>
          )}
        </Button>
      )}

      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
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

        {(!on || compact) && (
          <div className="space-y-2">
            <Label htmlFor={`meet-url-${meetingId}`} className="text-xs">
              Meeting link
            </Label>
            <Input
              id={`meet-url-${meetingId}`}
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="meet.google.com/…"
              className="rounded-xl text-sm"
              disabled={loading}
            />
          </div>
        )}
      </div>

      {!compact && (
        <p className="text-xs text-muted-foreground">
          Sends <strong className="font-medium text-foreground">{displayName}</strong>{" "}
          into the call — admit them from the Meet waiting room if you host.
          {voiceAgentEnabled ? (
            <>
              {" "}
              They will speak by voice once admitted.
            </>
          ) : null}
        </p>
      )}

      {!compact && (
        <Button
          onClick={() => void schedule()}
          disabled={loading || on || !meetingUrl.trim()}
          variant={on ? "default" : "outline"}
          className="rounded-full"
        >
          {loading && !on
            ? "Updating…"
            : on
              ? "AI assistant scheduled"
              : "Schedule AI assistant"}
        </Button>
      )}

      {meetingUrl.trim() && (
        <Button
          type="button"
          variant={compact ? "default" : on ? "secondary" : "default"}
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
