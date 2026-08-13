#!/usr/bin/env node
/**
 * Quick DB check for join flow (uses .env.local service role).
 * Usage: npm run db:diagnose
 */

const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!base || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const PROBE_USER = "00000000-0000-4000-8000-000000000001";
const PROBE_ORG = "00000000-0000-4000-8000-000000000002";
const PROBE_MEETING = "00000000-0000-4000-8000-000000000003";

async function rpc(name, body) {
  const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let msg = text;
  try {
    const j = JSON.parse(text);
    msg = j.message ?? j.error ?? text;
  } catch {
    /* plain text */
  }
  return String(msg);
}

function rpcInstalled(msg, fn) {
  if (!msg) return true;
  if (/user_id.*meeting_bots|column "user_id" of relation "meeting_bots"/i.test(msg)) {
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

const probes = [
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

console.log("MeetMind database (join flow):\n");
let missing = 0;
for (const [fn, body] of probes) {
  const msg = await rpc(fn, body);
  const ok = rpcInstalled(msg, fn);
  if (!ok) missing += 1;
  console.log(
    `  ${fn}: ${ok ? "installed" : "MISSING"}`,
    ok ? "" : `\n    → ${msg.slice(0, 200)}`,
  );
}

const res = await fetch(`${base}/rest/v1/meeting_bots?select=id&limit=1`, {
  headers,
});
const botsText = await res.text();
console.log(
  "\nmeeting_bots table:",
  res.ok ? "OK" : `HTTP ${res.status} — ${botsText.slice(0, 200)}`,
);

if (missing > 0) {
  const ref = new URL(base).hostname.split(".")[0];
  console.log(
    `\nFix: open https://supabase.com/dashboard/project/${ref}/sql/new`,
  );
  console.log(
    "Paste supabase/PATCH_meeting_bots.sql (quick) or supabase/RUN_IN_SQL_EDITOR.sql → Run → retry Join meeting.",
  );
  console.log(
    "Or add SUPABASE_DB_URL to .env.local and run: npm run db:fix",
  );
  process.exit(1);
}

console.log("\nAll join RPCs look installed. If Join still fails, check server logs.");
