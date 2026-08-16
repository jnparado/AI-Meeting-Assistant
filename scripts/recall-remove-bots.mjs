#!/usr/bin/env node
/**
 * Remove Recall bots from a Google Meet link (leaves the call).
 *
 * Usage:
 *   npm run recall:remove-bots -- https://meet.google.com/abc-defg-hij
 *   npm run recall:remove-bots -- https://meet.google.com/abc-defg-hij --keep-one
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const p = resolve(process.cwd(), ".env.local");
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "").trim();
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* no .env.local */
  }
}

function normalizeMeetUrl(input) {
  const trimmed = input.trim();
  const code = trimmed.match(/\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i)?.[1];
  if (code) return `https://meet.google.com/${code.toLowerCase()}`;
  try {
    const u = new URL(trimmed);
    u.search = "";
    u.hash = "";
    return `${u.origin}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

loadEnvLocal();

const args = process.argv.slice(2);
const keepOne = args.includes("--keep-one");
const meetUrlArg = args.find((a) => a.startsWith("http") || /-[a-z]{4}-/i.test(a));
const key = process.env.RECALL_API_KEY?.trim();
const region =
  process.env.RECALL_REGION?.trim() ||
  process.env.RECALLAI_REGION?.trim() ||
  "ap-northeast-1";
const base =
  process.env.RECALL_API_BASE?.trim()?.replace(/\/$/, "") ||
  `https://${region}.recall.ai`;

if (!key) {
  console.error("Missing RECALL_API_KEY in .env.local");
  process.exit(1);
}

if (!meetUrlArg) {
  console.error(
    "Usage: npm run recall:remove-bots -- https://meet.google.com/abc-defg-hij [--keep-one]",
  );
  process.exit(1);
}

const meetingUrl = normalizeMeetUrl(meetUrlArg);

const listUrl = new URL(`${base}/api/v1/bot/`);
listUrl.searchParams.set("meeting_url", meetingUrl);

const listRes = await fetch(listUrl, {
  headers: {
    Authorization: `Token ${key}`,
    Accept: "application/json",
  },
});

if (!listRes.ok) {
  console.error(`List bots failed (${listRes.status}):`, await listRes.text());
  process.exit(1);
}

const payload = await listRes.json();
const bots = Array.isArray(payload)
  ? payload
  : Array.isArray(payload.results)
    ? payload.results
    : [];

if (!bots.length) {
  console.log(`No Recall bots found for ${meetingUrl}`);
  process.exit(0);
}

const sorted = [...bots].sort(
  (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
);
const toRemove = keepOne ? sorted.slice(1) : sorted;

console.log(`Meeting: ${meetingUrl}`);
console.log(`Found ${bots.length} bot(s)`);
if (keepOne && sorted[0]) {
  console.log(`Keeping newest: ${sorted[0].id}`);
}

for (const bot of toRemove) {
  const id = bot.id;
  const name = bot.bot_name ?? "(no name)";
  const statusChanges = bot.status_changes ?? [];
  const status = statusChanges.at(-1)?.code ?? "unknown";

  if (["done", "completed", "failed", "fatal"].includes(String(status))) {
    console.log(`Skipped ${id} (${name}, ${status}) — already finished`);
    continue;
  }

  const inCall = [
    "joining_call",
    "in_waiting_room",
    "in_call",
    "in_call_recording",
    "call_ended",
  ].includes(String(status));

  if (inCall) {
    const leaveRes = await fetch(`${base}/api/v1/bot/${id}/leave_call/`, {
      method: "POST",
      headers: { Authorization: `Token ${key}` },
    });
    if (leaveRes.ok || leaveRes.status === 404) {
      console.log(`Left call ${id} (${name}, ${status})`);
      continue;
    }
    console.error(
      `Failed to leave call ${id} (${leaveRes.status}):`,
      (await leaveRes.text()).slice(0, 200),
    );
    continue;
  }

  const delRes = await fetch(`${base}/api/v1/bot/${id}/`, {
    method: "DELETE",
    headers: { Authorization: `Token ${key}` },
  });
  if (delRes.ok || delRes.status === 404) {
    console.log(`Deleted scheduled bot ${id} (${name}, ${status})`);
    continue;
  }
  if (delRes.status === 405) {
    const leaveRes = await fetch(`${base}/api/v1/bot/${id}/leave_call/`, {
      method: "POST",
      headers: { Authorization: `Token ${key}` },
    });
    if (leaveRes.ok || leaveRes.status === 404) {
      console.log(`Left call ${id} (${name}, ${status})`);
      continue;
    }
    console.error(
      `Failed to leave call ${id} (${leaveRes.status}):`,
      (await leaveRes.text()).slice(0, 200),
    );
    continue;
  }
  console.error(
    `Failed to remove ${id} (${delRes.status}):`,
    (await delRes.text()).slice(0, 200),
  );
}

console.log(
  keepOne
    ? "Done. One bot remains on this Meet link."
    : "Done. All Recall bots removed from this Meet link.",
);
