import { z } from "zod";
import { detectMeetingPlatform } from "@/lib/calendar/parse-meeting-url";

const meetingUrlSchema = z.string().url().max(2048);

export function validateMeetingUrl(url: string): {
  ok: true;
  platform: ReturnType<typeof detectMeetingPlatform>;
} | {
  ok: false;
  error: string;
} {
  const parsed = meetingUrlSchema.safeParse(url.trim());
  if (!parsed.success) {
    return { ok: false, error: "Invalid meeting URL" };
  }

  const platform = detectMeetingPlatform(parsed.data);
  if (platform === "unknown") {
    return {
      ok: false,
      error: "URL must be a Google Meet, Zoom, or Microsoft Teams link",
    };
  }

  return { ok: true, platform };
}

export const createMeetingBotSchema = z.object({
  meetingId: z.string().uuid(),
  meetingUrl: z.string().url().max(2048),
  botName: z.string().min(2).max(120).optional(),
  joinAt: z.string().datetime().optional(),
  joinNow: z.boolean().optional(),
});

export type CreateMeetingBotInput = z.infer<typeof createMeetingBotSchema>;
