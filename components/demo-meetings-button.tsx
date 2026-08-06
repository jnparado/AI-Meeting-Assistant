"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DemoMeetingsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function loadDemo() {
    setLoading(true);
    await fetch("/api/demo/meetings", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={loadDemo} disabled={loading}>
      {loading ? "Loading…" : "Load demo meetings"}
    </Button>
  );
}
