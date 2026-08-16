"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  ExternalLink,
  Loader2,
  MessageSquareReply,
  Mic,
  Radio,
  Users,
} from "lucide-react";
import { formatFetchError } from "@/lib/client/format-fetch-error";
import { BotLeaveButton } from "@/components/bot-leave-button";
import { AssistantToggle } from "@/components/assistant-toggle";
import {
  botStatusToneClasses,
  getBotMonitorSteps,
  getBotStatusDisplay,
} from "@/lib/bot/status-timeline";
import {
  draftReplyToMessage,
  getLastParticipantMessage,
  type ConversationFeedItem,
} from "@/lib/transcripts/conversation-feed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";

type LivePayload = {
  isLive: boolean;
  hasBot: boolean;
  canStop: boolean;
  canSpeak: boolean;
  botId: string | null;
  botName: string | null;
  botStatus: BotStatus | null;
  segments: TranscriptSegment[];
  conversation: ConversationFeedItem[];
  livePartial: { speaker: string; text: string } | null;
  pendingSpeechCount: number;
};

const BLOCKED_SPEAK_STATUSES = new Set<BotStatus>([
  "failed",
  "cancelled",
  "completed",
  "meeting_ended",
]);

function isSpeakBlocked(status: BotStatus | null | undefined): boolean {
  return Boolean(status && BLOCKED_SPEAK_STATUSES.has(status));
}

function speakHint(input: {
  speakEnabled: boolean;
  hasBotRecord: boolean;
  botStatus: BotStatus | null;
  isLive: boolean;
  hasScript: boolean;
}): string {
  if (!input.hasScript) {
    return "Loading intro script…";
  }
  if (!input.hasBotRecord && !input.speakEnabled) {
    return "Send Jerome to Meet below first, then click Speak now.";
  }
  if (!input.speakEnabled) {
    return "Send to Meet again and admit the bot, then click Speak now.";
  }
  if (input.botStatus === "waiting_room") {
    return "Admit Jerome in Google Meet — his reply will speak once he joins.";
  }
  if (input.botStatus === "joining" || input.botStatus === "scheduled") {
    return "Reply is queued — Jerome speaks once he is in the call.";
  }
  if (input.isLive) {
    return "Jerome reads this word-for-word in the meeting.";
  }
  return "Type Jerome's reply, then click Speak now.";
}

type Props = {
  meetingId: string;
  meetingUrl?: string | null;
  initialBotName?: string | null;
  initialBotStatus?: BotStatus | null;
  initialIsLive?: boolean;
  hasBot?: boolean;
  aiAssistantEnabled?: boolean;
  voiceAgentEnabled?: boolean;
  initialSegments?: TranscriptSegment[];
  defaultScript?: string;
};

function MonitorStepper({
  steps,
  progressStep,
  toneClasses,
}: {
  steps: readonly string[];
  progressStep: number;
  toneClasses: ReturnType<typeof botStatusToneClasses>;
}) {
  return (
    <div className="mt-4">
      <div className="hidden sm:flex sm:items-center">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const reached = progressStep >= stepNumber;
          const current = progressStep === stepNumber;
          const isLast = index === steps.length - 1;

          return (
            <div key={step} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              <div className="flex min-w-0 flex-col items-center gap-1.5">
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
                    current
                      ? toneClasses.badge
                      : reached
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {reached && !current ? "✓" : stepNumber}
                </div>
                <span
                  className={`max-w-[4.5rem] text-center text-[11px] font-medium leading-tight ${
                    current
                      ? "text-foreground"
                      : reached
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {step}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded-full ${
                    progressStep > stepNumber ? "bg-emerald-500" : "bg-border"
                  }`}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 sm:hidden">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const reached = progressStep >= stepNumber;
          const current = progressStep === stepNumber;
          return (
            <span
              key={step}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                current
                  ? toneClasses.badge
                  : reached
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function BotMonitorPanel({
  meetingId,
  meetingUrl = null,
  initialBotName,
  initialBotStatus = null,
  initialIsLive = false,
  hasBot: initialHasBot = false,
  aiAssistantEnabled = false,
  voiceAgentEnabled = false,
  initialSegments = [],
  defaultScript = "",
}: Props) {
  const searchParams = useSearchParams();
  const justJoined =
    searchParams.get("joined") === "1" ||
    searchParams.get("joined") === "existing";
  const [script, setScript] = useState(defaultScript);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(initialIsLive);
  const [hasBot, setHasBot] = useState(initialHasBot);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(initialBotStatus);
  const [botName, setBotName] = useState<string | null>(
    initialBotName ?? null,
  );
  const [conversation, setConversation] = useState<ConversationFeedItem[]>(() =>
    initialSegments.map((seg, i) => ({
      id: `init-${i}`,
      kind: "participant" as const,
      speaker: seg.speaker ?? "Speaker",
      text: seg.text,
    })),
  );
  const [pendingSpeechCount, setPendingSpeechCount] = useState(0);
  const [canStop, setCanStop] = useState(initialHasBot || initialIsLive);
  const [canSpeak, setCanSpeak] = useState(
    initialHasBot && !isSpeakBlocked(initialBotStatus),
  );
  const feedRef = useRef<HTMLDivElement>(null);

  const displayBotName = botName?.trim() || "Jerome";
  const showBotSession = hasBot || initialHasBot || justJoined || canStop || isLive;
  const hasBotRecord = hasBot || initialHasBot || justJoined || canStop || canSpeak;
  const speakEnabled =
    canSpeak ||
    (hasBotRecord && !isSpeakBlocked(botStatus) && Boolean(botStatus || isLive));
  const lastParticipant = getLastParticipantMessage(conversation);

  useEffect(() => {
    if (justJoined) {
      setHasBot(true);
      setCanSpeak(true);
    }
  }, [justJoined]);

  useEffect(() => {
    if (defaultScript.trim()) {
      setScript((current) => (current.trim() ? current : defaultScript));
    }
  }, [defaultScript]);

  useEffect(() => {
    if (!voiceAgentEnabled) return;
    let cancelled = false;

    async function loadDefaultScript() {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/default-script`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { script?: string };
        const text = data.script?.trim();
        if (text && !cancelled) {
          setScript((current) => (current.trim() ? current : text));
        }
      } catch {
        /* ignore */
      }
    }

    void loadDefaultScript();
    return () => {
      cancelled = true;
    };
  }, [meetingId, voiceAgentEnabled]);

  const scrollFeed = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollFeed();
  }, [conversation, scrollFeed]);

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
        setCanStop(data.canStop ?? data.hasBot);
        setCanSpeak(data.canSpeak ?? false);
        setBotStatus(data.botStatus);
        setBotName(data.botName);
        setConversation(data.conversation ?? []);
        setPendingSpeechCount(data.pendingSpeechCount ?? 0);
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

  async function handleSpeakNow() {
    const trimmed = script.trim();
    if (!trimmed || speaking) return;

    setSpeaking(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json()) as {
        error?: string;
        lines?: string[];
      };
      if (!res.ok) {
        setError(data.error ?? "Could not send script to the bot");
        return;
      }
      setConversation((prev) => [
        ...prev.filter((item) => item.kind !== "partial"),
        {
          id: `local-${Date.now()}`,
          kind: "your_reply",
          speaker: `You → ${displayBotName}`,
          text: trimmed,
          delivered: false,
        },
      ]);
      setPendingSpeechCount((count) => count + (data.lines?.length ?? 1));
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setSpeaking(false);
    }
  }

  function useLastMessageAsReply() {
    if (!lastParticipant) return;
    setScript(draftReplyToMessage(lastParticipant));
  }

  function useMessageAsReply(item: ConversationFeedItem) {
    if (item.kind === "your_reply") return;
    setScript(draftReplyToMessage(item));
  }

  const statusDisplay = getBotStatusDisplay(botStatus, {
    botName: displayBotName,
    justJoined: justJoined && !hasBot && !botStatus,
    hasBot: hasBot || initialHasBot,
  });
  const toneClasses = botStatusToneClasses(statusDisplay.tone);
  const monitorSteps = getBotMonitorSteps();

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <div className="flex flex-col gap-4 border-b bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="size-5 text-primary" aria-hidden />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Bot control center</h2>
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Radio className="size-3 animate-pulse" aria-hidden />
                  Live
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              See the conversation, type Jerome&apos;s reply, speak in Meet
            </p>
          </div>
        </div>

        <BotLeaveButton
          meetingId={meetingId}
          meetingUrl={meetingUrl}
          botName={displayBotName}
          label={showBotSession ? "Leave meeting" : "Remove bot from Meet"}
          size="lg"
          className="w-full shrink-0 sm:w-auto"
        />
      </div>

      {showBotSession && (
        <div
          className={`border-b px-5 py-4 ${toneClasses.panel}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex size-2.5 rounded-full ${toneClasses.dot}`}
                  aria-hidden
                />
                <p className="text-sm font-semibold">{statusDisplay.headline}</p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses.badge}`}
                >
                  {statusDisplay.shortLabel}
                </span>
              </div>
              {statusDisplay.detail && (
                <p className="text-sm text-muted-foreground">
                  {statusDisplay.detail}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pendingSpeechCount > 0 && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {pendingSpeechCount} queued
                </span>
              )}
              {meetingUrl && botStatus === "waiting_room" && (
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Open Meet & admit
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          </div>
          <MonitorStepper
            steps={monitorSteps}
            progressStep={statusDisplay.progressStep}
            toneClasses={toneClasses}
          />
        </div>
      )}

      <div className="space-y-4 p-5">
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold">Conversation</h3>
              </div>
              {lastParticipant && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5"
                  onClick={useLastMessageAsReply}
                >
                  <MessageSquareReply className="size-3.5" aria-hidden />
                  Reply to last
                </Button>
              )}
            </div>

            <div
              ref={feedRef}
              className="min-h-[200px] max-h-80 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-3"
            >
              {conversation.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {!hasBotRecord
                    ? "Send Jerome to Meet first. When others talk in the meeting, their lines appear here."
                    : botStatus === "waiting_room"
                      ? "Admit Jerome in Google Meet. When others speak, you will see their words here."
                      : isLive
                        ? "Waiting for others to speak in the meeting…"
                        : "Others' speech appears here once the bot joins and people talk in Meet."}
                </p>
              )}

              {conversation.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => useMessageAsReply(item)}
                  disabled={item.kind === "your_reply"}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    item.kind === "your_reply"
                      ? "ml-4 border border-primary/20 bg-primary/10"
                      : item.kind === "partial"
                        ? "border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10"
                        : "bg-background hover:bg-background/90"
                  } ${item.kind === "your_reply" ? "cursor-default" : "cursor-pointer"}`}
                >
                  <p className="text-xs font-medium text-primary">
                    {item.speaker}
                    {item.kind === "your_reply" && (
                      <span className="ml-2 text-muted-foreground">
                        {item.delivered ? "· spoken" : "· queued"}
                      </span>
                    )}
                    {item.kind === "partial" && (
                      <span className="ml-2 italic text-muted-foreground">
                        · speaking…
                      </span>
                    )}
                  </p>
                  <p
                    className={`mt-0.5 ${
                      item.kind === "partial"
                        ? "italic text-muted-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.text}
                  </p>
                  {item.kind !== "your_reply" && (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      Click to use as reply draft
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">
                Jerome&apos;s reply (speaks in Meet)
              </h3>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={
                lastParticipant
                  ? `Type what ${displayBotName} should say in response…`
                  : `Type exactly what ${displayBotName} should say…`
              }
              disabled={speaking}
              rows={4}
              className="min-h-[100px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={speaking || !script.trim()}
                onClick={() => void handleSpeakNow()}
                className="rounded-full gap-2"
              >
                {speaking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Mic className="size-4" aria-hidden />
                    Speak now
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {speakHint({
                  speakEnabled,
                  hasBotRecord,
                  botStatus,
                  isLive,
                  hasScript: Boolean(script.trim()),
                })}
              </span>
            </div>
          </section>
        </div>

      <div className="border-t bg-muted/20 px-5 py-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Send bot to Google Meet
        </p>
        <AssistantToggle
          meetingId={meetingId}
          meetingUrl={meetingUrl}
          enabled={aiAssistantEnabled}
          initialBotName={initialBotName ?? undefined}
          voiceAgentEnabled={voiceAgentEnabled}
          botStatus={botStatus ?? initialBotStatus}
          hasScheduledBot={initialHasBot || hasBot || justJoined}
          compact
          hideLeave
          onBotSent={() => {
            setHasBot(true);
            setCanSpeak(true);
          }}
        />
      </div>

      {(error || pollError) && (
        <div className="border-t px-5 py-3">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {pollError && !error && (
            <p
              className="text-sm text-amber-700 dark:text-amber-400"
              role="status"
            >
              {pollError}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
