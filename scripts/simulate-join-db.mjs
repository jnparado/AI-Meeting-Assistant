#!/usr/bin/env node
/**
 * End-to-end join DB simulation (service role). npm run db:simulate-join
 */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!base || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const h = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function get(path) {
  const r = await fetch(`${base}${path}`, { headers: h });
  const t = await r.text();
  return { ok: r.ok, status: r.status, text: t, json: tryJson(t) };
}

function tryJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

async function rpc(name, body) {
  const r = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
  const t = await r.text();
  return { status: r.status, text: t, json: tryJson(t) };
}

const usersRes = await fetch(`${base}/auth/v1/admin/users?per_page=5`, { headers: h });
const usersJson = await usersRes.json();
const user = usersJson.users?.[0];
if (!user) {
  console.error("No auth users in project");
  process.exit(1);
}
const userId = user.id;
console.log("User:", user.email, userId);

const members = await get(
  `/rest/v1/organization_members?user_id=eq.${userId}&select=organization_id&limit=1`,
);
const orgId = members.json?.[0]?.organization_id;
if (!orgId) {
  console.error("No organization for user — run fix_user_organization.sql or sign up again");
  process.exit(1);
}
console.log("Org:", orgId);

const ext = `adhoc:sim:${Date.now()}`;
const meetingRpc = await rpc("meetmind_create_adhoc_meeting", {
  p_user_id: userId,
  p_organization_id: orgId,
  p_meeting_url: "https://meet.google.com/abc-defg-hij",
  p_external_calendar_id: ext,
  p_title: "Simulated Meet",
});
console.log("\nmeetmind_create_adhoc_meeting:", meetingRpc.status, meetingRpc.text.slice(0, 300));

let meetingId = meetingRpc.json;
if (!meetingId && meetingRpc.status !== 200) {
  const ins = await fetch(`${base}/rest/v1/meetings`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      user_id: userId,
      organization_id: orgId,
      external_calendar_id: ext + ":fb",
      title: "Simulated Meet",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3600000).toISOString(),
      meeting_url: "https://meet.google.com/abc-defg-hij",
      platform: "google_meet",
    }),
  });
  const insT = await ins.text();
  console.log("meetings insert fallback:", ins.status, insT.slice(0, 300));
  meetingId = tryJson(insT)?.[0]?.id ?? tryJson(insT)?.id;
}

if (!meetingId) {
  console.error("Could not create meeting");
  process.exit(1);
}
console.log("Meeting:", meetingId);

await rpc("meetmind_prepare_meeting_join", {
  p_meeting_id: meetingId,
  p_meeting_url: "https://meet.google.com/abc-defg-hij",
});

const botRpc = await rpc("meetmind_insert_meeting_bot", {
  p_meeting_id: meetingId,
  p_user_id: userId,
  p_bot_name: "MeetMind AI Notetaker",
  p_status: "joining",
});
console.log("\nmeetmind_insert_meeting_bot:", botRpc.status, botRpc.text.slice(0, 400));

if (!botRpc.json || botRpc.status >= 400) {
  const payloads = [
    {
      meeting_id: meetingId,
      user_id: userId,
      status: "joining",
      scheduled_for: new Date().toISOString(),
      bot_name: "MeetMind AI Notetaker",
    },
    {
      meeting_id: meetingId,
      user_id: userId,
      scheduled_for: new Date().toISOString(),
    },
  ];
  for (const body of payloads) {
    const r = await fetch(`${base}/rest/v1/meeting_bots`, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    const t = await r.text();
    console.log("meeting_bots insert:", JSON.stringify(body).slice(0, 80), r.status, t.slice(0, 300));
    if (r.ok) break;
  }
} else {
  console.log("Bot OK:", botRpc.json);
}
