#!/usr/bin/env node
/**
 * Generate RSA key + self-signed cert for Google Workspace SSO (Recall bot login).
 * Usage: npm run recall:google-sso-keygen
 *
 * Writes:
 *   secrets/recall-google-sso.key.pem
 *   secrets/recall-google-sso.cert.pem
 */
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "secrets");
const keyPath = resolve(dir, "recall-google-sso.key.pem");
const certPath = resolve(dir, "recall-google-sso.cert.pem");

if (existsSync(keyPath) || existsSync(certPath)) {
  console.error(
    "SSO keys already exist in secrets/. Delete them first if you need to regenerate.",
  );
  console.error(`  ${keyPath}`);
  console.error(`  ${certPath}`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

console.log("Generating 2048-bit RSA key + self-signed cert (10 year validity)…\n");

execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -sha256 -days 3650 -nodes -subj "/CN=Recall Google Meet Bot SSO"`,
  { stdio: "inherit" },
);

console.log("\nCreated:");
console.log(`  ${keyPath}`);
console.log(`  ${certPath}\n`);

console.log("Add to .env.local:");
console.log("RECALL_GOOGLE_SSO_PRIVATE_KEY_PATH=./secrets/recall-google-sso.key.pem");
console.log("RECALL_GOOGLE_SSO_CERT_PATH=./secrets/recall-google-sso.cert.pem\n");

console.log("Next — Google Admin (bot's dedicated Workspace, NOT your main org):");
console.log("1. admin.google.com → Security → Authentication → SSO with third party IdP");
console.log("2. Add legacy SSO profile → Enable SSO");
console.log("3. Upload secrets/recall-google-sso.cert.pem as verification certificate");
console.log("4. Check 'Use a domain-specific issuer' → Save");
console.log("5. Manage SSO profile assignments → assign legacy profile to org\n");

console.log("Then add login in Recall:");
console.log("  Dashboard → Google Logins → Add Login");
console.log("  Or: npm run recall:google-login-add");
