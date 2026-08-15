#!/usr/bin/env node
/**
 * Copy SSO PEM files to clipboard for Recall dashboard "Add Login".
 *
 * Usage:
 *   npm run recall:google-sso-copy -- cert   # certificate → clipboard
 *   npm run recall:google-sso-copy -- key    # private key → clipboard
 *   npm run recall:google-sso-copy           # show paths + instructions
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "secrets");
const keyPath = resolve(dir, "recall-google-sso.key.pem");
const certPath = resolve(dir, "recall-google-sso.cert.pem");

function readPem(path) {
  if (!existsSync(path)) {
    console.error(`Missing: ${path}`);
    console.error("Run: npm run recall:google-sso-keygen");
    process.exit(1);
  }
  return readFileSync(path, "utf8").trim();
}

function copyToClipboard(text) {
  try {
    execSync("pbcopy", { input: text });
    return true;
  } catch {
    return false;
  }
}

const target = process.argv[2]?.toLowerCase();

if (target === "cert" || target === "certificate") {
  const pem = readPem(certPath);
  if (copyToClipboard(pem)) {
    console.log("Certificate copied to clipboard.");
    console.log("Paste into Recall → Google Logins → Add Login → Certificate");
  } else {
    console.log("Open and copy all of:");
    console.log(`  ${certPath}`);
  }
  process.exit(0);
}

if (target === "key" || target === "private-key") {
  const pem = readPem(keyPath);
  if (copyToClipboard(pem)) {
    console.log("Private key copied to clipboard.");
    console.log("Paste into Recall → Google Logins → Add Login → Private key");
    console.log("Do not share this key or commit it to git.");
  } else {
    console.log("Open and copy all of:");
    console.log(`  ${keyPath}`);
  }
  process.exit(0);
}

console.log("SSO files (already created):\n");
console.log(`  Private key:  ${keyPath}`);
console.log(`  Certificate:  ${certPath}\n`);
console.log("Copy into Recall dashboard → google admod Bot Group → Add Login:\n");
console.log("  npm run recall:google-sso-copy -- cert   # copy certificate");
console.log("  npm run recall:google-sso-copy -- key    # copy private key\n");
console.log("Or in Cursor: open each file, Cmd+A, Cmd+C, paste into Recall.\n");
console.log("Also upload the .cert.pem in Google Admin → SSO verification certificate.");
