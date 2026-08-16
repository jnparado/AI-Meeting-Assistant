"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFetchError } from "@/lib/client/format-fetch-error";
import { stopMeetingBot } from "@/lib/bot/stop-meeting-bot-client";
import { Loader2, MessageCircleQuestion, Radio, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";

const SUGGESTIONS = [
  "Summarize what we've discussed so far",
  "What decisions were made?",
  "What are the action items?",
];

const LEAVABLE_STATUSES = new Set<BotStatus>([
  "scheduled",
  "joining",
  "waiting_room",
  "joined",
  "recording",
]);

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type LivePayload = {
  isLive: boolean;
  hasBot: boolean;
  botName: string | null;
  botStatus: BotStatus | null;
  segments: TranscriptSegment[];
  fullText: string;
  livePartial: { speaker: string; text: string } | null;
};

type Props = {
  meetingId: string;
  hasTranscript: boolean;
  isLive: boolean;
  hasBot?: boolean;
  initialSegments?: TranscriptSegment[];
  hideBotControls?: boolean;
};

export function MeetingQnaPanel({
  meetingId,
  hasTranscript,
  isLive: initialIsLive,
  hasBot: initialHasBot = false,
  initialSegments = [],
  hideBotControls = false,
}: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(initialIsLive);
  const [hasBot, setHasBot] = useState(initialHasBot);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [botName, setBotName] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [livePartial, setLivePartial] = useState<{
    speaker: string;
    text: string;
  } | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const canAskFromTranscript =
    !hasBot && (hasTranscript || segments.length > 0);
  const showBotSpeak = hasBot && !hideBotControls;
  const canStopBot =
    showBotSpeak &&
    (botStatus ? LEAVABLE_STATUSES.has(botStatus) : true);
  const displayBotName = botName?.trim() || "the bot";

  const scrollFeed = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollFeed();
  }, [segments, livePartial, chat, scrollFeed]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/live`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as LivePayload;
        if (cancelled) return;
        setPollError(null);
        setIsLive(data.isLive);
        setHasBot(data.hasBot);
        setBotStatus(data.botStatus);
        setBotName(data.botName);
        setSegments(data.segments ?? []);
        setLivePartial(data.livePartial);
      } catch (err) {
        if (!cancelled) {
          setPollError(formatFetchError(err));
        }
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [meetingId]);

  async function stopBot() {
    if (
      !window.confirm(
        `Stop ${displayBotName} and remove them from the meeting?`,
      )
    ) {
      return;
    }

    setStopping(true);
    setError(null);
    try {
      const result = await stopMeetingBot(meetingId);
      if (!result.ok) {
        setError(result.error ?? "Could not stop the bot");
        return;
      }
      setHasBot(false);
      setIsLive(false);
      setBotStatus(null);
      router.refresh();
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setStopping(false);
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setLoading(true);
    setError(null);
    setChat((prev) => [...prev, userMsg]);
    setInput("");

    try {
      if (showBotSpeak) {
        const res = await fetch(`/api/meetings/${meetingId}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = (await res.json()) as {
          text?: string;
          lines?: string[];
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Could not send to the bot");
          return;
        }
        return;
      }

      if (!canAskFromTranscript) {
        setError("Send your AI assistant to the meeting first.");
        return;
      }

      const res = await fetch(`/api/meetings/${meetingId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not get a response");
        return;
      }
      setChat((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.answer ?? "",
        },
      ]);
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  if (hideBotControls && !canAskFromTranscript) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircleQuestion className="size-4" aria-hidden />
              Ask about this meeting
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Radio className="size-3" aria-hidden />
                  Live
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {showBotSpeak
                ? isLive
                  ? `Type what ${displayBotName} should say. Other participants appear below. Bot speech is hidden so it is not repeated.`
                  : `Type what ${displayBotName} should say. Add “Now can you introduce yourself” at the end to queue his greeting too.`
                : canAskFromTranscript
                  ? "Questions are answered from the transcript (speakers, decisions, action items)."
                  : "Send your AI assistant to the meeting, then type what it should say."}
            </CardDescription>
          </div>
          {canStopBot && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={stopping || loading}
              onClick={() => void stopBot()}
              className="shrink-0 rounded-full"
            >
              {stopping ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Square className="size-3.5 fill-current" aria-hidden />
                  Stop bot
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={feedRef}
          className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isLive ? "Live conversation" : "Conversation"}
          </p>

          {segments.length === 0 && !livePartial && chat.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {hasBot && isLive
                ? "Waiting for others in the meeting to speak…"
                : hasBot
                  ? "Send the bot to the meeting, then type what they should say."
                  : isLive
                    ? "Listening… start speaking in the meeting."
                    : "No transcript yet. When the bot is in the call, speech appears here in real time."}
            </p>
          )}

          {segments.map((seg, i) => (
            <div
              key={`${seg.speaker}-${i}-${seg.text.slice(0, 24)}`}
              className="rounded-lg bg-background/80 px-3 py-2 text-sm"
            >
              <p className="text-xs font-medium text-primary">
                {seg.speaker ?? "Speaker"}
              </p>
              <p className="mt-0.5 text-muted-foreground">{seg.text}</p>
            </div>
          ))}

          {livePartial && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-primary">
                {livePartial.speaker}
              </p>
              <p className="mt-0.5 text-muted-foreground italic">
                {livePartial.text}
              </p>
            </div>
          )}

          {chat.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {hasBot ? "Sent to the bot" : "Your chat with MeetMind"}
              </p>
              {chat.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "ml-6 bg-primary/10"
                      : "mr-6 border border-border bg-background/80"
                  }`}
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {msg.role === "user"
                      ? hasBot
                        ? "Your script"
                        : "You"
                      : "MeetMind"}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {canAskFromTranscript && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void sendMessage(s)}
                disabled={loading}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              showBotSpeak
                ? isLive
                  ? `Type what ${displayBotName} should say… (end with “Now can you introduce yourself” for his greeting)`
                  : `Type what ${displayBotName} should say once they join…`
                : "Ask MeetMind or tell it what to focus on…"
            }
            className="rounded-full"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-full"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Send"}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {pollError && !error && (
          <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
            {pollError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
