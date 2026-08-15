#!/usr/bin/env node
/**
 * Send a test Recall bot to a Google Meet URL (same as dashboard "Run Request").
 * Usage: npm run recall:send-bot -- https://meet.google.com/abc-defg-hij
 */
import { createHmac } from "node:crypto";
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

const meetUrl = process.argv.find((a) => a.startsWith("http"))?.trim();
const key = process.env.RECALL_API_KEY?.trim();
const region =
  process.env.RECALL_REGION?.trim() ||
  process.env.RECALLAI_REGION?.trim() ||
  "ap-northeast-1";
const base =
  process.env.RECALL_API_BASE?.trim()?.replace(/\/$/, "") ||
  `https://${region}.recall.ai`;
const groupId = process.env.RECALL_GOOGLE_LOGIN_GROUP_ID?.trim();
const loginEnabled =
  process.env.RECALL_GOOGLE_LOGIN_ENABLED?.trim().toLowerCase();
const useGoogleLogin =
  groupId &&
  (loginEnabled === "1" || loginEnabled === "true" || loginEnabled === "yes");
const botName =
  process.env.RECALL_TEST_BOT_NAME?.trim() ||
  process.env.RECALL_DEFAULT_BOT_NAME?.trim() ||
  "Adsense John";

function voiceAgentSecret() {
  return (
    process.env.VOICE_AGENT_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.BOT_SIMULATION_SECRET?.trim() ||
    null
  );
}

function voiceAgentEnabled() {
  const v = process.env.RECALL_VOICE_AGENT_ENABLED?.trim().toLowerCase();
  const hasLlm =
    Boolean(process.env.XAI_API_KEY?.trim()) ||
    Boolean(process.env.GROK_API_KEY?.trim()) ||
    Boolean(process.env.OPENAI_API_KEY?.trim());
  return hasLlm && (v === "1" || v === "true" || v === "yes");
}

function voiceAgentPageUrl(name) {
  const appBase = (
    process.env.RECALL_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const url = new URL(`${appBase}/bot-agent`);
  const secret = voiceAgentSecret();
  if (secret) {
    const exp = Date.now() + 6 * 60 * 60 * 1000;
    const sig = createHmac("sha256", secret)
      .update(`voice-agent:${exp}`)
      .digest("hex");
    url.searchParams.set("token", `${exp}.${sig}`);
  }
  if (name?.trim()) url.searchParams.set("botName", name.trim());
  return url.toString();
}

function realtimeWebhookUrl() {
  const appBase = (
    process.env.RECALL_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const token =
    process.env.RECALL_REALTIME_WEBHOOK_TOKEN?.trim() ||
    process.env.RECALL_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  const path = `${appBase}/api/webhooks/recall/realtime/`;
  return token ? `${path}?token=${encodeURIComponent(token)}` : path;
}

if (!key) {
  console.error("Missing RECALL_API_KEY in .env.local");
  process.exit(1);
}

if (!meetUrl) {
  console.error(
    "Usage: npm run recall:send-bot -- https://meet.google.com/abc-defg-hij\n\n" +
      "Start a Meet at https://meet.google.com/new and paste the URL.",
  );
  process.exit(1);
}

const body = {
  bot_name: botName,
  meeting_url: meetUrl,
  ...(useGoogleLogin
    ? { google_meet: { google_login_group_id: groupId } }
    : {}),
  ...(voiceAgentEnabled()
    ? {
        output_media: {
          camera: {
            kind: "webpage",
            config: { url: voiceAgentPageUrl(botName) },
          },
        },
        variant: {
          zoom: "web_4_core",
          google_meet: "web_4_core",
          microsoft_teams: "web_4_core",
        },
      }
    : {}),
  recording_config: {
    transcript: {
      provider: {
        recallai_streaming: {
          mode: "prioritize_low_latency",
          language_code: "en",
        },
      },
    },
    ...(voiceAgentEnabled()
      ? { include_bot_in_recording: { audio: true } }
      : {}),
    realtime_endpoints: [
      {
        type: "webhook",
        url: realtimeWebhookUrl(),
        events: ["transcript.data", "transcript.partial_data"],
      },
    ],
  },
  automatic_leave: {
    waiting_room_timeout: 600,
    noone_joined_timeout: 600,
  },
  metadata: { source: "recall-send-test-bot" },
};

console.log(`Sending bot to ${meetUrl}`);
console.log(`  region: ${region}`);
console.log(`  bot_name: ${botName}`);
if (useGoogleLogin && groupId)
  console.log(`  google_login_group_id: ${groupId} (signed-in)`);
else if (groupId)
  console.log(
    "  google_login: guest mode (enable RECALL_GOOGLE_LOGIN_ENABLED=true after SSO login)",
  );
if (voiceAgentEnabled())
  console.log(`  voice_agent: enabled → ${voiceAgentPageUrl(botName)}`);
console.log("");

const res = await fetch(`${base}/api/v1/bot/`, {
  method: "POST",
  headers: {
    Authorization: `Token ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text.slice(0, 600));
  process.exit(1);
}

const bot = JSON.parse(text);
console.log("Bot created:");
console.log(`  id: ${bot.id}`);
console.log(`  status: ${bot.status?.code ?? bot.status ?? "scheduled"}`);
console.log(
  `\nOpen Meet and admit "${botName}" from the waiting room (if host).`,
);
console.log(
  `Explorer: ${base}/dashboard/explorer/bot/?meeting_url=${encodeURIComponent(meetUrl)}`,
);
