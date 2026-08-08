"use client";

import { useState } from "react";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SUGGESTIONS = [
  "What decisions were made?",
  "What are the action items?",
  "Who owns the next steps?",
];

type Props = {
  meetingId: string;
  hasTranscript: boolean;
};

export function MeetingQnaPanel({ meetingId, hasTranscript }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const text = q.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not get an answer");
        return;
      }
      setAnswer(data.answer ?? "");
      setQuestion(text);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!hasTranscript) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircleQuestion className="size-4" aria-hidden />
            Ask about this meeting
          </CardTitle>
          <CardDescription>
            Available after the AI finishes recording and transcribing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestion className="size-4" aria-hidden />
          Ask about this meeting
        </CardTitle>
        <CardDescription>
          Questions are answered from the transcript (speakers, decisions, action
          items).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={loading}
              className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs transition-colors hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What did we agree on for the launch date?"
            className="rounded-full"
            disabled={loading}
          />
          <Button type="submit" disabled={loading} className="shrink-0 rounded-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
          </Button>
        </form>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {answer && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
