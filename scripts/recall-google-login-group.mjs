#!/usr/bin/env node
/**
 * Create or list Recall Google Login Groups.
 *
 * Usage:
 *   npm run recall:google-group              # create group
 *   npm run recall:google-group -- --list    # list existing groups
 *   npm run recall:google-group -- --name "Production Primary"
 *   npm run recall:google-group -- --set-login-mode only_if_required
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

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
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
      "Add RECALL_API_KEY and RECALL_REGION, then run npm run recall:test",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Token ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function recallFetch(path, options = {}) {
  const res = await fetch(`${base}${path}`, { headers, ...options });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Recall (${res.status}): ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

const listMode = process.argv.includes("--list");
const setLoginMode = getArg("--set-login-mode");

if (setLoginMode) {
  const groupId = process.env.RECALL_GOOGLE_LOGIN_GROUP_ID?.trim();
  if (!groupId) {
    console.error("Set RECALL_GOOGLE_LOGIN_GROUP_ID in .env.local first.");
    process.exit(1);
  }
  if (!["always", "only_if_required"].includes(setLoginMode)) {
    console.error("Use --set-login-mode always or only_if_required");
    process.exit(1);
  }
  const updated = await recallFetch(`/api/v2/google-login-groups/${groupId}/`, {
    method: "PATCH",
    body: JSON.stringify({ login_mode: setLoginMode }),
  });
  console.log(`Updated login_mode → ${updated.login_mode} for ${updated.name}`);
  process.exit(0);
}

if (listMode) {
  const json = await recallFetch("/api/v2/google-login-groups/");
  const groups = json.results ?? [];
  if (!groups.length) {
    console.log("No Google Login Groups yet. Run: npm run recall:google-group");
    process.exit(0);
  }
  console.log(`Google Login Groups (${groups.length}):\n`);
  for (const g of groups) {
    const loginCount = g.logins?.length ?? 0;
    console.log(`  ${g.name}`);
    console.log(`    id: ${g.id}`);
    console.log(`    login_mode: ${g.login_mode}`);
    console.log(`    logins: ${loginCount}`);
    console.log("");
  }
  console.log("Add to .env.local (and Vercel):");
  console.log(`RECALL_GOOGLE_LOGIN_GROUP_ID=${groups[0].id}`);
  process.exit(0);
}

const name =
  getArg("--name") ||
  process.env.RECALL_GOOGLE_LOGIN_GROUP_NAME?.trim() ||
  "MeetMind Bot Group";
const loginMode =
  getArg("--login-mode") ||
  process.env.RECALL_GOOGLE_LOGIN_MODE?.trim() ||
  "always";

console.log(`Creating Google Login Group at ${base} …`);
console.log(`  name: ${name}`);
console.log(`  login_mode: ${loginMode}\n`);

const group = await recallFetch("/api/v2/google-login-groups/", {
  method: "POST",
  body: JSON.stringify({ name, login_mode: loginMode }),
});

console.log("Created Google Login Group:\n");
console.log(`  id: ${group.id}`);
console.log(`  name: ${group.name}`);
console.log(`  login_mode: ${group.login_mode}\n`);

console.log("Add to .env.local and Vercel:");
console.log(`RECALL_GOOGLE_LOGIN_GROUP_ID=${group.id}\n`);

console.log("Next steps (Step 2–3 in Recall docs):");
console.log("1. Create a dedicated Google Workspace user for the bot (e.g. bot@yourdomain.com).");
console.log("2. In Google Admin → Security → SSO, generate a key pair and register the x509 cert.");
console.log("3. Add the login to Recall:");
console.log("   npm run recall:google-login-add");
console.log("\nDocs: https://docs.recall.ai/docs/google-meet-login-getting-started");
