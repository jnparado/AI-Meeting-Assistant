"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SyncCalendarButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/calendar/sync", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Sync failed");
      return;
    }
    setMessage(`Imported ${data.imported ?? 0} events`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button onClick={sync} disabled={loading} variant="secondary">
        {loading ? "Syncing…" : "Import upcoming meetings"}
      </Button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
