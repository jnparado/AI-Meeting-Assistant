#!/usr/bin/env node
/**
 * Check Google Login Group + login count; print setup checklist.
 * Usage: npm run recall:google-status
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
const groupId = process.env.RECALL_GOOGLE_LOGIN_GROUP_ID?.trim();

if (!key) {
  console.error("Missing RECALL_API_KEY in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Token ${key}`,
  Accept: "application/json",
};

async function recallFetch(path, options = {}) {
  const res = await fetch(`${base}${path}`, { headers, ...options });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Recall (${res.status}): ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

console.log(`Recall region: ${region}`);
console.log(`Dashboard: ${base.replace("https://", "https://")}/dashboard/explorer/google-logins\n`);

const json = await recallFetch("/api/v2/google-login-groups/");
const groups = json.results ?? [];

if (!groups.length) {
  console.log("No login groups. Run: npm run recall:google-group");
  process.exit(1);
}

const active =
  groups.find((g) => g.id === groupId) ??
  groups[0];

console.log(`Active group: ${active.name}`);
console.log(`  id: ${active.id}`);
console.log(`  login_mode: ${active.login_mode}`);
console.log(`  logins: ${active.logins?.length ?? 0}\n`);

if (groupId && groupId !== active.id) {
  console.log(
    `Warning: RECALL_GOOGLE_LOGIN_GROUP_ID=${groupId} not found; showing first group.\n`,
  );
}

const loginCount = active.logins?.length ?? 0;
const email = process.env.RECALL_GOOGLE_LOGIN_EMAIL?.trim();
const domain = process.env.RECALL_GOOGLE_WORKSPACE_DOMAIN?.trim();
const keyPath = process.env.RECALL_GOOGLE_SSO_PRIVATE_KEY_PATH?.trim();
const certPath = process.env.RECALL_GOOGLE_SSO_CERT_PATH?.trim();

console.log("Checklist:\n");

const items = [
  ["Recall API key + region", true],
  ["Google Login Group created", true],
  [
    "Login group has at least 1 Google Login",
    loginCount > 0,
    loginCount > 0
      ? "done"
      : "Recall dashboard → Google Logins → Add Login (or npm run recall:google-login-add)",
  ],
  [
    "Dedicated Google Workspace (NOT your main shirwei.com workspace)",
    false,
    "Use a new paid Workspace on a subdomain, e.g. sso.shirwei.com",
  ],
  [
    "Bot Google account signed in once (accept terms)",
    false,
    "Sign in as bot@sso.shirwei.com in a browser before enabling SSO",
  ],
  [
    "SSO key pair generated",
    Boolean(keyPath && certPath),
    "npm run recall:google-sso-keygen",
  ],
  [
    "Google Admin SSO profile + cert uploaded",
    false,
    "admin.google.com → Security → SSO with third party IdP",
  ],
  [
    ".env.local bot email + domain set",
    Boolean(email && domain && !email.includes("yourdomain")),
    email && domain ? `${email} @ ${domain}` : "Set RECALL_GOOGLE_LOGIN_EMAIL + RECALL_GOOGLE_WORKSPACE_DOMAIN",
  ],
  [
    "Vercel env vars (RECALL_*)",
    false,
    "Same values as .env.local for production",
  ],
  [
    "Recall webhook registered",
    false,
    `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "YOUR_APP"}/api/webhooks/recall`,
  ],
];

for (const [label, done, hint] of items) {
  const mark = done ? "[x]" : "[ ]";
  console.log(`  ${mark} ${label}`);
  if (!done && hint) console.log(`      → ${hint}`);
}

console.log("");

if (loginCount === 0 && active.login_mode === "always") {
  console.log(
    "Tip: With login_mode=always and 0 logins, bots may fail to join.\n" +
      "  Quick test as guest: npm run recall:google-group -- --set-login-mode only_if_required\n" +
      "  After SSO login is added, set back: npm run recall:google-group -- --set-login-mode always\n",
  );
}

if (loginCount > 0) {
  console.log("Ready for signed-in bots. Test with:");
  console.log("  npm run recall:send-bot -- https://meet.google.com/xxx-yyyy-zzz\n");
} else {
  console.log("Test as guest (while SSO is pending):");
  console.log("  npm run recall:send-bot -- https://meet.google.com/xxx-yyyy-zzz\n");
}

console.log("Docs: https://docs.recall.ai/docs/google-meet-login-getting-started");
