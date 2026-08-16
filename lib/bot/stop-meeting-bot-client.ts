import { readJsonResponse } from "@/lib/client/read-json-response";

export async function stopMeetingBot(meetingId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await fetch("/api/meeting-bots", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ meetingId }),
  });
  const data = await readJsonResponse(res);
  if (!res.ok) {
    return { ok: false, error: String(data.error ?? "Could not stop the bot") };
  }
  return { ok: true };
}
