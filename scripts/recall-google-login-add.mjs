#!/usr/bin/env node
/**
 * Register a Google Workspace SSO login with a Recall Google Login Group.
 *
 * Required env (.env.local):
 *   RECALL_API_KEY
 *   RECALL_GOOGLE_LOGIN_GROUP_ID
 *   RECALL_GOOGLE_LOGIN_EMAIL          e.g. bot@yourdomain.com
 *   RECALL_GOOGLE_WORKSPACE_DOMAIN     e.g. yourdomain.com
 *   RECALL_GOOGLE_SSO_PRIVATE_KEY_PATH path to PEM private key
 *   RECALL_GOOGLE_SSO_CERT_PATH        path to PEM x509 cert
 *
 * Or inline PEM (escape newlines as \\n in .env):
 *   RECALL_GOOGLE_SSO_PRIVATE_KEY
 *   RECALL_GOOGLE_SSO_CERT
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

function readPem(envValue, pathEnvName) {
  const inline = envValue?.trim();
  if (inline) {
    return inline.includes("\\n") ? inline.replace(/\\n/g, "\n") : inline;
  }
  const path = process.env[pathEnvName]?.trim();
  if (!path) return null;
  return readFileSync(resolve(process.cwd(), path), "utf8").trim();
}

loadEnvLocal();

const key = process.env.RECALL_API_KEY?.trim();
const region =
  process.env.RECALL_REGION?.trim() ||
  process.env.RECALLAI_REGION?.trim() ||
  "us-west-2";
const base =
  process.env.RECALL_API_BASE?.trim()?.replace(/\/$/, "") ||
  `https://${region}.recall.ai`;

const groupId = process.env.RECALL_GOOGLE_LOGIN_GROUP_ID?.trim();
const email = process.env.RECALL_GOOGLE_LOGIN_EMAIL?.trim();
const domain = process.env.RECALL_GOOGLE_WORKSPACE_DOMAIN?.trim();
const privateKey = readPem(
  process.env.RECALL_GOOGLE_SSO_PRIVATE_KEY,
  "RECALL_GOOGLE_SSO_PRIVATE_KEY_PATH",
);
const cert = readPem(
  process.env.RECALL_GOOGLE_SSO_CERT,
  "RECALL_GOOGLE_SSO_CERT_PATH",
);

const missing = [];
if (!key) missing.push("RECALL_API_KEY");
if (!groupId) missing.push("RECALL_GOOGLE_LOGIN_GROUP_ID");
if (!email) missing.push("RECALL_GOOGLE_LOGIN_EMAIL");
if (!domain) missing.push("RECALL_GOOGLE_WORKSPACE_DOMAIN");
if (!privateKey) {
  missing.push(
    "RECALL_GOOGLE_SSO_PRIVATE_KEY or RECALL_GOOGLE_SSO_PRIVATE_KEY_PATH",
  );
}
if (!cert) {
  missing.push("RECALL_GOOGLE_SSO_CERT or RECALL_GOOGLE_SSO_CERT_PATH");
}

if (missing.length) {
  console.error("Missing required env in .env.local:\n");
  for (const m of missing) console.error(`  - ${m}`);
  console.error(
    "\nRun npm run recall:google-group first, then configure Workspace SSO.\n" +
      "Docs: https://docs.recall.ai/docs/google-meet-login",
  );
  process.exit(1);
}

console.log(`Creating Google Login at ${base} …`);
console.log(`  group_id: ${groupId}`);
console.log(`  email: ${email}`);
console.log(`  domain: ${domain}\n`);

const res = await fetch(`${base}/api/v2/google-logins/`, {
  method: "POST",
  headers: {
    Authorization: `Token ${key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    group_id: groupId,
    sso_v2_workspace_domain: domain,
    sso_v2_private_key: privateKey,
    sso_v2_cert: cert,
    is_active: true,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}):`, text.slice(0, 600));
  process.exit(1);
}

const login = JSON.parse(text);
console.log("Google Login created:\n");
console.log(`  id: ${login.id}`);
console.log(`  email: ${login.email}`);
console.log(`  group_id: ${login.group_id}\n`);
console.log(
  "Bots will sign into Google Meet using this account when RECALL_GOOGLE_LOGIN_GROUP_ID is set.",
);
console.log(
  "Add to .env.local and Vercel, then restart:\n  RECALL_GOOGLE_LOGIN_ENABLED=true",
);
