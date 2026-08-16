"use client";

import { useState } from "react";
import { Loader2, Square } from "lucide-react";
import { formatFetchError } from "@/lib/client/format-fetch-error";
import { stopMeetingBot } from "@/lib/bot/stop-meeting-bot-client";
import { Button } from "@/components/ui/button";

type Props = {
  meetingId: string;
  meetingUrl?: string | null;
  botName?: string | null;
  label?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
  confirm?: boolean;
  onLeft?: () => void;
};

export function BotLeaveButton({
  meetingId,
  meetingUrl = null,
  botName,
  label = "Leave meeting",
  size = "default",
  className,
  confirm = true,
  onLeft,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = botName?.trim() || "the bot";

  async function leave() {
    if (
      confirm &&
      !window.confirm(
        `Remove ${displayName} from Google Meet and stop the bot?`,
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await stopMeetingBot(meetingId, meetingUrl);
      if (!result.ok) {
        setError(result.error ?? "Could not stop the bot");
        return;
      }
      onLeft?.();
      window.location.assign(`/dashboard/meetings/${meetingId}`);
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="destructive"
        size={size}
        disabled={loading}
        onClick={() => void leave()}
        className="gap-2 rounded-full"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Leaving…
          </>
        ) : (
          <>
            <Square className="size-3.5 fill-current" aria-hidden />
            {label}
          </>
        )}
      </Button>
      {error && (
        <p className="mt-2 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
