#!/usr/bin/env node
/**
 * Verify Recall API key and region. Usage: npm run recall:test
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

loadEnvLocal();

const key = process.env.RECALL_API_KEY?.trim();
const region =
  process.env.RECALL_REGION?.trim() ||
  process.env.RECALLAI_REGION?.trim() ||
  "ap-northeast-1";
const base =
  process.env.RECALL_API_BASE?.trim()?.replace(/\/$/, "") ||
  `https://${region}.recall.ai`;

if (!key) {
  console.error(
    "Missing RECALL_API_KEY in .env.local\n\n" +
      "1. Sign up at https://www.recall.ai/\n" +
      "2. Dashboard → API keys → copy key and note region (us-west-2, us-east-1, etc.)\n" +
      "3. Add to .env.local:\n" +
      "   RECALL_API_KEY=your_key\n" +
      "   RECALL_REGION=us-west-2\n" +
      "4. Restart npm run dev\n" +
      "5. In Recall → Webhooks, add your app URL + /api/webhooks/recall",
  );
  process.exit(1);
}

console.log(`Testing Recall at ${base} …`);

const res = await fetch(`${base}/api/v1/bot/`, {
  headers: { Authorization: `Token ${key}` },
});

if (res.status === 401 || res.status === 403) {
  console.error(
    `Auth failed (${res.status}). Check RECALL_API_KEY and RECALL_REGION=${region}`,
  );
  process.exit(1);
}

if (res.ok || res.status === 405 || res.status === 400) {
  console.log("OK — Recall API reachable with your key.");

  const groupId = process.env.RECALL_GOOGLE_LOGIN_GROUP_ID?.trim();
  if (groupId) {
    console.log(`Google Login Group configured: ${groupId}`);
  } else {
    console.log(
      "Google Login Group not set — bots join as guests unless login is required.",
    );
    console.log("Create one: npm run recall:google-group");
    console.log(
      "Then add Workspace SSO login: npm run recall:google-login-add",
    );
  }

  console.log("Send AI bot from /join — admit Adsense John in Google Meet.");
  process.exit(0);
}

console.error(`Unexpected ${res.status}:`, (await res.text()).slice(0, 300));
process.exit(1);
