"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Integrations = {
  follow_up_email: boolean;
  follow_up_slack: boolean;
  follow_up_crm: boolean;
  slack_webhook_url: string | null;
  crm_provider: string | null;
  crm_access_token: string | null;
  notification_email: string | null;
};

export function SettingsForm({
  integrations,
}: {
  integrations: Integrations | null;
}) {
  const [form, setForm] = useState({
    follow_up_email: integrations?.follow_up_email ?? true,
    follow_up_slack: integrations?.follow_up_slack ?? false,
    follow_up_crm: integrations?.follow_up_crm ?? false,
    slack_webhook_url: integrations?.slack_webhook_url ?? "",
    crm_provider: integrations?.crm_provider ?? "hubspot",
    crm_access_token: integrations?.crm_access_token ?? "",
    notification_email: integrations?.notification_email ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) setSaved(true);
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up channels</CardTitle>
          <CardDescription>
            Email summaries are held for your approval on each meeting page after
            the AI finishes. Slack and CRM channels (Phase 2) send automatically when
            configured.
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.follow_up_email}
              onChange={(e) =>
                setForm({ ...form, follow_up_email: e.target.checked })
              }
            />
            Email
          </label>
          <div className="space-y-2">
            <Label htmlFor="notification_email">Notification email</Label>
            <Input
              id="notification_email"
              type="email"
              value={form.notification_email}
              onChange={(e) =>
                setForm({ ...form, notification_email: e.target.value })
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.follow_up_slack}
              onChange={(e) =>
                setForm({ ...form, follow_up_slack: e.target.checked })
              }
            />
            Slack incoming webhook
          </label>
          <Input
            placeholder="https://hooks.slack.com/services/..."
            value={form.slack_webhook_url}
            onChange={(e) =>
              setForm({ ...form, slack_webhook_url: e.target.value })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.follow_up_crm}
              onChange={(e) =>
                setForm({ ...form, follow_up_crm: e.target.checked })
              }
            />
            CRM (HubSpot note)
          </label>
          <Input
            placeholder="HubSpot private app token"
            type="password"
            value={form.crm_access_token}
            onChange={(e) =>
              setForm({ ...form, crm_access_token: e.target.value })
            }
          />
        </CardContent>
      </Card>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save integrations"}
      </Button>
      {saved && (
        <p className="text-sm text-muted-foreground">Settings saved.</p>
      )}
    </form>
  );
}

export function CalendarConnectLinks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calendar</CardTitle>
        <CardDescription>
          Import upcoming events with video links from Google or Microsoft.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/connect"
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          Open calendar connection
        </Link>
      </CardContent>
    </Card>
  );
}
