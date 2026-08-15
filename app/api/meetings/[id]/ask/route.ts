import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/org/server";
import { answerMeetingQuestion } from "@/lib/ai/meeting-qna";
import type { TranscriptSegment } from "@/lib/types/database";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: meetingId } = await context.params;
  const body = (await request.json()) as { question?: string };
  const question = body.question?.trim();

  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
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

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title")
    .eq("id", meetingId)
    .eq("organization_id", organization.id)
    .single();

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("full_text, segments")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  const segments = (transcript?.segments as TranscriptSegment[] | null) ?? [];
  const fullText = transcript?.full_text ?? "";

  const { data: bot } = await supabase
    .from("meeting_bots")
    .select("status")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const liveStatuses = new Set([
    "joining",
    "waiting_room",
    "joined",
    "recording",
  ]);
  const isLive = liveStatuses.has(String(bot?.status ?? ""));

  if (!fullText && segments.length === 0 && !isLive) {
    return NextResponse.json(
      { error: "No transcript yet. Wait for the AI assistant to finish." },
      { status: 400 },
    );
  }

  const answer = await answerMeetingQuestion(
    meeting.title,
    fullText,
    segments,
    question,
    { live: isLive },
  );

  return NextResponse.json({ answer });
}
