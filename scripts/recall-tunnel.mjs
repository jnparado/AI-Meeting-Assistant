#!/usr/bin/env node
/**
 * Expose localhost:3000 for Recall voice agent + webhooks (local dev).
 *
 * Uses Cloudflare quick tunnel by default — no localtunnel IP gate (Recall bots
 * cannot click through that page). Optional: RECALL_TUNNEL_PROVIDER=localtunnel
 *
 * Usage: npm run recall:tunnel
 * Restart `npm run dev`, then send a NEW bot.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const envPath = resolve(process.cwd(), ".env.local");
const provider =
  process.env.RECALL_TUNNEL_PROVIDER?.trim().toLowerCase() || "cloudflare";

console.log(`Starting ${provider} tunnel to http://localhost:${PORT} …`);
console.log("Keep this running while testing the talking bot.\n");

let url = "";
let child = null;

function tryPatchEnv(publicUrl) {
  try {
    let text = readFileSync(envPath, "utf8");
    const line = `RECALL_PUBLIC_APP_URL=${publicUrl}`;
    if (/^RECALL_PUBLIC_APP_URL=/m.test(text)) {
      text = text.replace(/^RECALL_PUBLIC_APP_URL=.*$/m, line);
    } else {
      text = `${text.trim()}\n\n# Public URL for Recall (voice agent + live transcript)\n${line}\n`;
    }
    writeFileSync(envPath, text);
    console.log(`\nUpdated .env.local → RECALL_PUBLIC_APP_URL=${publicUrl}`);
    console.log(
      "Restart npm run dev (next.config allows *.trycloudflare.com), then send a NEW bot.\n",
    );
  } catch {
    console.log(`\nAdd to .env.local:\nRECALL_PUBLIC_APP_URL=${publicUrl}\n`);
  }
}

function captureUrl(text) {
  if (url) return;
  const cloudflare = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  const localtunnel = text.match(/https:\/\/[^\s]+\.loca\.lt/i);
  const match = provider === "localtunnel" ? localtunnel || cloudflare : cloudflare || localtunnel;
  if (match) {
    url = match[0].replace(/\/$/, "");
    tryPatchEnv(url);
  }
}

function startCloudflare() {
  if (provider === "localtunnel") return startLocaltunnel();
  console.log(
    "Tip: Cloudflare quick tunnel has no browser gate — works with Recall bots.\n",
  );
  child = spawn(
    "npx",
    ["--yes", "cloudflared", "tunnel", "--url", `http://localhost:${PORT}`],
    { stdio: ["ignore", "pipe", "pipe"], shell: false },
  );
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    captureUrl(text);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    captureUrl(text);
  });
  child.on("close", (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
}

function startLocaltunnel() {
  console.warn(
    "Warning: localtunnel shows an IP verification page that Recall bots cannot pass.\n" +
      "Prefer Cloudflare (default): npm run recall:tunnel\n\n",
  );
  child = spawn(
    "npx",
    ["--yes", "localtunnel", "--port", String(PORT)],
    { stdio: ["ignore", "pipe", "pipe"], shell: false },
  );
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    captureUrl(text);
  });
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  child.on("close", (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
}

startCloudflare();

process.on("SIGINT", () => {
  child?.kill("SIGINT");
  process.exit(0);
});
