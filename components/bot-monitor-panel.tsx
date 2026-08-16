"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  ExternalLink,
  Loader2,
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BotStatus, TranscriptSegment } from "@/lib/types/database";

type LivePayload = {
  isLive: boolean;
  hasBot: boolean;
  hasActiveBot: boolean;
  canStop: boolean;
  canSpeak: boolean;
  botName: string | null;
  botStatus: BotStatus | null;
  segments: TranscriptSegment[];
  livePartial: { speaker: string; text: string } | null;
  pendingSpeechCount: number;
  sentScripts: { text: string; delivered: boolean }[];
};

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
}: Props) {
  const searchParams = useSearchParams();
  const justJoined =
    searchParams.get("joined") === "1" ||
    searchParams.get("joined") === "existing";
  const [script, setScript] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(initialIsLive);
  const [hasBot, setHasBot] = useState(initialHasBot);
  const [canSpeak, setCanSpeak] = useState(initialHasBot);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(initialBotStatus);
  const [botName, setBotName] = useState<string | null>(
    initialBotName ?? null,
  );
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [livePartial, setLivePartial] = useState<{
    speaker: string;
    text: string;
  } | null>(null);
  const [pendingSpeechCount, setPendingSpeechCount] = useState(0);
  const [sentScripts, setSentScripts] = useState<
    { text: string; delivered: boolean }[]
  >([]);
  const feedRef = useRef<HTMLDivElement>(null);

  const displayBotName = botName?.trim() || "Jerome";
  const showBotSession = hasBot || initialHasBot || justJoined;

  const scrollFeed = useCallback(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollFeed();
  }, [segments, livePartial, sentScripts, scrollFeed]);

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
        setCanSpeak(data.canSpeak);
        setBotStatus(data.botStatus);
        setBotName(data.botName);
        setSegments(data.segments ?? []);
        setLivePartial(data.livePartial);
        setPendingSpeechCount(data.pendingSpeechCount ?? 0);
        setSentScripts(data.sentScripts ?? []);
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

  async function speakScript() {
    const trimmed = script.trim();
    if (!trimmed) return;

    setSpeaking(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send script to the bot");
        return;
      }
      setScript("");
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setSpeaking(false);
    }
  }

  const statusDisplay = getBotStatusDisplay(botStatus, {
    botName: displayBotName,
    justJoined,
  });
  const toneClasses = botStatusToneClasses(statusDisplay.tone);
  const monitorSteps = getBotMonitorSteps();

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      {/* Header */}
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
              {displayBotName} · monitor, speak, and leave
            </p>
          </div>
        </div>

        {showBotSession && (
          <BotLeaveButton
            meetingId={meetingId}
            botName={displayBotName}
            label="Leave meeting"
            size="lg"
            className="w-full shrink-0 sm:w-auto"
          />
        )}
      </div>

      {/* Status */}
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

      {/* Speak + Monitor */}
      {showBotSession && (
        <div className="grid lg:grid-cols-2 lg:divide-x">
          <section className="space-y-3 border-b p-5 lg:border-b-0">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">Speak in meeting</h3>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Type exactly what ${displayBotName} should say…`}
              disabled={speaking || !canSpeak}
              rows={6}
              className="min-h-[140px] w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={speaking || !canSpeak || !script.trim()}
                onClick={() => void speakScript()}
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
              {!canSpeak && (
                <span className="text-xs text-muted-foreground">
                  Available once the bot is in the call
                </span>
              )}
            </div>

            {sentScripts.length > 0 && (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your scripts
                </p>
                {sentScripts.map((item, i) => (
                  <div
                    key={`${item.text.slice(0, 24)}-${i}`}
                    className="rounded-lg bg-background px-3 py-2 text-sm"
                  >
                    <p className="text-xs text-muted-foreground">
                      {item.delivered ? "Spoken" : "Queued"}
                    </p>
                    <p className="mt-0.5 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" aria-hidden />
              <h3 className="text-sm font-semibold">
                {isLive ? "Live conversation" : "Meeting monitor"}
              </h3>
            </div>
            <div
              ref={feedRef}
              className="min-h-[220px] max-h-72 space-y-2 overflow-y-auto rounded-xl border bg-muted/20 p-3"
            >
              {segments.length === 0 && !livePartial && (
                <p className="text-sm text-muted-foreground">
                  {isLive
                    ? "Waiting for others to speak…"
                    : "Others’ speech appears here once the bot joins."}
                </p>
              )}
              {segments.map((seg, i) => (
                <div
                  key={`${seg.speaker}-${i}-${seg.text.slice(0, 24)}`}
                  className="rounded-lg bg-background px-3 py-2 text-sm"
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
                  <p className="mt-0.5 italic text-muted-foreground">
                    {livePartial.text}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Send bot */}
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
          botStatus={initialBotStatus}
          hasScheduledBot={initialHasBot || hasBot}
          compact
          hideLeave
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
