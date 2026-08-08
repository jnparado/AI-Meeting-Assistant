import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireActiveOrganization, ORG_COOKIE } from "@/lib/org/server";
import { ensureUserWorkspace } from "@/lib/org/ensure-workspace";
import { joinMeetingNow } from "@/lib/bot/join-meeting-now";
import { validateMeetingUrl } from "@/lib/bot/validate-meeting-url";
import { SubscriptionError } from "@/lib/bot/credits";
import { hasRecall } from "@/lib/env";

const joinNowSchema = z.object({
  meetingUrl: z.string().min(8).max(2048),
  botName: z.string().min(2).max(120).optional(),
  meetingId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = joinNowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const urlCheck = validateMeetingUrl(parsed.data.meetingUrl);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  try {
    const meta = user.user_metadata as {
      full_name?: string;
      organization_name?: string;
    };
    await ensureUserWorkspace(user.id, user.email ?? undefined, {
      full_name: meta.full_name,
      organization_name: meta.organization_name,
    });

    const organization = await requireActiveOrganization(user.id);

    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE, organization.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    const result = await joinMeetingNow(
      user.id,
      organization.id,
      parsed.data.meetingUrl,
      parsed.data.botName,
      parsed.data.meetingId,
    );

    return NextResponse.json({
      ok: true,
      provider: hasRecall() ? "recall" : "simulation",
      message: hasRecall()
        ? "AI bot is joining the meeting on Google Meet. Admit “AI Notetaker” from the waiting room if prompted."
        : "Simulation started (set RECALL_API_KEY for a real Google Meet join).",
      meetingId: result.bot.meeting_id,
      bot: result.bot,
      resolvedMeetingUrl: result.resolvedMeetingUrl,
    });
  } catch (err) {
    if (err instanceof SubscriptionError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 },
      );
    }
    let message = err instanceof Error ? err.message : "Join failed";
    if (/null value in column "provider"/i.test(message)) {
      message =
        "Meeting provider column error. In Supabase SQL Editor, run supabase/migrations/009_meetmind_rpc_provider.sql, redeploy the app, then try again.";
    } else if (/schema cache/i.test(message)) {
      message =
        "Database needs a quick update. Run npm run db:fix (add SUPABASE_DB_URL to .env.local), or paste supabase/RUN_IN_SQL_EDITOR.sql into Supabase → SQL Editor → Run, then try again.";
    } else if (/no organization found/i.test(message)) {
      message =
        "No workspace linked to your account. In Supabase SQL Editor, run supabase/fix_user_organization.sql (set v_only_email to your login email), then try again.";
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  const supabase = createServiceClient();
  const checks: Record<string, string> = {};

  for (const fn of [
    "meetmind_create_adhoc_meeting",
    "meetmind_insert_meeting_bot",
    "meetmind_prepare_meeting_join",
    "meetmind_ensure_active_subscription",
  ] as const) {
    const { error } = await supabase.rpc(fn as string, {} as never);
    const msg = error?.message ?? "";
    const missing =
      /could not find the function|does not exist|schema cache/i.test(msg) &&
      msg.includes(fn);
    checks[fn] = missing
      ? "missing — run supabase/RUN_IN_SQL_EDITOR.sql in Supabase SQL Editor"
      : "installed";
  }

  return NextResponse.json({
    recallConfigured: hasRecall(),
    mode: hasRecall() ? "live" : "simulation",
    databaseFunctions: checks,
    docs: "https://docs.recall.ai/",
  });
}
