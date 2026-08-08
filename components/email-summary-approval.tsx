"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MeetingInsights } from "@/lib/ai/summarize-meeting";

type Props = {
  meetingId: string;
  insights: MeetingInsights;
  notificationEmail: string | null;
};

export function EmailSummaryApproval({
  meetingId,
  insights,
  notificationEmail,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run(action: "approve" | "dismiss") {
    setLoading(action);
    setError(null);

    const res = await fetch(`/api/meetings/${meetingId}/approve-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Request failed");
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p className="text-sm text-primary" role="status">
        Email summary updated.
      </p>
    );
  }

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Email summary approval</CardTitle>
        <CardDescription>
          Review the summary below, then approve to email it
          {notificationEmail ? (
            <>
              {" "}
              to <span className="font-medium text-foreground">{notificationEmail}</span>
            </>
          ) : (
            <>
              . Add a notification email in{" "}
              <a href="/dashboard/settings" className="text-primary underline-offset-4 hover:underline">
                Settings
              </a>{" "}
              first.
            </>
          )}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{insights.summary}</p>
        {insights.action_items.length > 0 && (
          <div>
            <p className="font-medium">Action items in email</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {insights.action_items.map((a) => (
                <li key={a.task}>{a.task}</li>
              ))}
            </ul>
          </div>
        )}
        {error ? <p className="text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!notificationEmail || loading !== null}
            onClick={() => void run("approve")}
          >
            {loading === "approve" ? "Sending…" : "Approve & send email"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading !== null}
            onClick={() => void run("dismiss")}
          >
            {loading === "dismiss" ? "…" : "Skip email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
