"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleQuestion, Radio } from "lucide-react";
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type LivePayload = {
  isLive: boolean;
  botStatus: BotStatus | null;
  segments: TranscriptSegment[];
  fullText: string;
  livePartial: { speaker: string; text: string } | null;
};

type Props = {
  meetingId: string;
  hasTranscript: boolean;
  isLive: boolean;
  initialSegments?: TranscriptSegment[];
};

export function MeetingQnaPanel({
  meetingId,
  hasTranscript,
  isLive: initialIsLive,
  initialSegments = [],
}: Props) {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(initialIsLive);
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [livePartial, setLivePartial] = useState<{
    speaker: string;
    text: string;
  } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const canInteract = isLive || hasTranscript || segments.length > 0;

  const scrollFeed = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollFeed();
  }, [segments, livePartial, chat, scrollFeed]);

  useEffect(() => {
    if (!initialIsLive && hasTranscript) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/live`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as LivePayload;
        if (cancelled) return;
        setIsLive(data.isLive);
        setSegments(data.segments ?? []);
        setLivePartial(data.livePartial);
      } catch {
        /* ignore poll errors */
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [meetingId, initialIsLive, hasTranscript]);

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
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
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
          {isLive
            ? "Live transcript updates below. Type a message and Send — MeetMind replies from the conversation so far."
            : canInteract
              ? "Questions are answered from the transcript (speakers, decisions, action items)."
              : "Send your AI assistant to the meeting to see live conversation here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={feedRef}
          className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isLive ? "Live conversation" : "Conversation"}
          </p>

          {segments.length === 0 && !livePartial && !isLive && (
            <p className="text-sm text-muted-foreground">
              No transcript yet. When the bot is in the call, speech appears here
              in real time.
            </p>
          )}

          {segments.length === 0 && isLive && !livePartial && (
            <p className="text-sm text-muted-foreground">
              Listening… start speaking in the meeting.
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
                Your chat with MeetMind
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
                    {msg.role === "user" ? "You" : "MeetMind"}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {canInteract && (
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
              canInteract
                ? "Ask MeetMind or tell it what to focus on…"
                : "Waiting for the AI assistant to join…"
            }
            className="rounded-full"
            disabled={loading || !canInteract}
          />
          <Button
            type="submit"
            disabled={loading || !canInteract || !input.trim()}
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
      </CardContent>
    </Card>
  );
}
