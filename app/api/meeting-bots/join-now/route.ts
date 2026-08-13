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
import { getSupabaseSqlEditorUrl } from "@/lib/supabase/config";

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
    const sqlEditor = getSupabaseSqlEditorUrl();
    const sqlHint = sqlEditor
      ? ` Open SQL Editor: ${sqlEditor}`
      : " Open Supabase → SQL Editor.";

    if (
      /null value in column "provider"/i.test(message) ||
      /schema cache/i.test(message) ||
      /RUN_IN_SQL_EDITOR/i.test(message) ||
      /PATCH_meeting_bots/i.test(message) ||
      /Could not create meeting row/i.test(message) ||
      /meeting_bots\.user_id column missing/i.test(message) ||
      /column "user_id" of relation "meeting_bots"/i.test(message) ||
      (/Failed to create bot/i.test(message) &&
        !/column "/i.test(message))
    ) {
      message =
        "Supabase needs a one-time SQL fix. In Supabase → SQL Editor, paste and run supabase/PATCH_meeting_bots.sql (quick) or the full supabase/RUN_IN_SQL_EDITOR.sql, then try Join meeting again." +
        sqlHint +
        " Or locally: add SUPABASE_DB_URL to .env.local and run npm run db:fix.";
    } else if (/no organization found/i.test(message)) {
      message =
        "No workspace linked to your account. In Supabase SQL Editor, run supabase/fix_user_organization.sql (set v_only_email to your login email), then try again.";
    }
    return NextResponse.json(
      {
        error: message,
        sqlEditorUrl: getSupabaseSqlEditorUrl(),
      },
      { status: 400 },
    );
  }
}

const PROBE_USER = "00000000-0000-4000-8000-000000000001";
const PROBE_ORG = "00000000-0000-4000-8000-000000000002";
const PROBE_MEETING = "00000000-0000-4000-8000-000000000003";

function rpcInstalled(errorMessage: string | undefined, fn: string): boolean {
  const msg = errorMessage ?? "";
  if (!msg) return true;
  if (
    /user_id.*meeting_bots|column "user_id" of relation "meeting_bots"/i.test(
      msg,
    )
  ) {
    return false;
  }
  if (/violates foreign-key constraint|insert or update on table/i.test(msg)) {
    return true;
  }
  if (/could not find the function/i.test(msg) && msg.includes(fn)) {
    return false;
  }
  if (/schema cache/i.test(msg)) return false;
  return !/could not find the function/i.test(msg);
}

export async function GET() {
  const supabase = createServiceClient();
  const checks: Record<string, string> = {};

  const probes: [string, Record<string, unknown>][] = [
    [
      "meetmind_create_adhoc_meeting",
      {
        p_user_id: PROBE_USER,
        p_organization_id: PROBE_ORG,
        p_meeting_url: "https://meet.google.com/abc-defg-hij",
        p_external_calendar_id: "probe",
        p_title: "Probe",
      },
    ],
    [
      "meetmind_insert_meeting_bot",
      {
        p_meeting_id: PROBE_MEETING,
        p_user_id: PROBE_USER,
        p_bot_name: "Probe",
        p_status: "scheduled",
      },
    ],
    [
      "meetmind_prepare_meeting_join",
      {
        p_meeting_id: PROBE_MEETING,
        p_meeting_url: "https://meet.google.com/abc-defg-hij",
      },
    ],
    [
      "meetmind_ensure_active_subscription",
      { p_organization_id: PROBE_ORG },
    ],
  ];

  for (const [fn, args] of probes) {
    const { error } = await supabase.rpc(fn, args);
    checks[fn] = rpcInstalled(error?.message, fn)
      ? "installed"
      : "missing — run supabase/RUN_IN_SQL_EDITOR.sql in Supabase SQL Editor";
  }

  const sqlEditorUrl = getSupabaseSqlEditorUrl();

  return NextResponse.json({
    recallConfigured: hasRecall(),
    mode: hasRecall() ? "live" : "simulation",
    databaseFunctions: checks,
    sqlEditorUrl,
    docs: "https://docs.recall.ai/",
  });
}
