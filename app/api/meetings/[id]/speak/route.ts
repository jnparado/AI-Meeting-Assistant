import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { loadMeetingForUserSecure } from "@/lib/meetings/load-meeting-for-user";
import { getRecallVoiceAgentGreeting } from "@/lib/bot/recall-voice-agent";
import { resolveActiveMeetingBot } from "@/lib/bot/resolve-active-meeting-bot";
import { expandIntroSpeakLines } from "@/lib/transcripts/filter-bot-speech";
import { enqueueBotSpeechBatch } from "@/lib/voice-agent/speech-queue";
import { isBotControllable } from "@/lib/bot/bot-control-status";
import type { BotStatus } from "@/lib/types/database";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: meetingId } = await context.params;
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const organization = await getActiveOrganization(user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const meeting = await loadMeetingForUserSecure(
    meetingId,
    user.id,
    organization.id,
  );

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const resolved = await resolveActiveMeetingBot({
    supabase,
    meetingId,
    organizationId: organization.id,
    userId: user.id,
    meetingUrl: (meeting.meeting_url as string | null) ?? null,
  });

  const bot = resolved ?? null;

  if (!bot?.id) {
    return NextResponse.json(
      {
        error:
          "No active bot for this meeting. Click Send to Meet now below, admit the bot, then try Speak now.",
      },
      { status: 400 },
    );
  }

  const status = String(bot.status ?? "") as BotStatus;
  if (!isBotControllable(status)) {
    return NextResponse.json(
      {
        error:
          "This bot is no longer active. Send to Meet again, then click Speak now.",
      },
      { status: 400 },
    );
  }

  try {
    const botName = (bot.bot_name as string | null) ?? undefined;
    const greeting = getRecallVoiceAgentGreeting(botName);
    const lines = expandIntroSpeakLines(text, greeting);
    const service = createServiceClient();
    const { ids, lines: queued } = await enqueueBotSpeechBatch(
      service,
      bot.id,
      lines,
    );
    return NextResponse.json({
      ok: true,
      ids,
      text: queued.join("\n\n"),
      lines: queued,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not queue speech";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
