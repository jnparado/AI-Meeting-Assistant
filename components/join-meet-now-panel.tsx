"use client";

import { SimpleAiJoin } from "@/components/simple-ai-join";

export function JoinMeetNowPanel({
  initialUrl,
}: {
  initialUrl?: string;
  meetingId?: string;
}) {
  return <SimpleAiJoin initialUrl={initialUrl ?? ""} />;
}
