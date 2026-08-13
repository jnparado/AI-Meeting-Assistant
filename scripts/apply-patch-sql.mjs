#!/usr/bin/env node
/**
 * Applies supabase/PATCH_meeting_bots.sql (minimal column fix).
 * Needs SUPABASE_DB_URL in .env.local — or paste the file in Supabase SQL Editor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sqlPath = resolve(root, "supabase/PATCH_meeting_bots.sql");

async function main() {
  const url =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    console.error(
      "Missing SUPABASE_DB_URL in .env.local.\n\n" +
        "Quick fix (no password needed):\n" +
        "  1. Open https://supabase.com/dashboard/project/zkzpryyfnviycyvbjaxi/sql/new\n" +
        "  2. Paste supabase/PATCH_meeting_bots.sql from this repo\n" +
        "  3. Click Run → retry Join meeting\n\n" +
        "Or add SUPABASE_DB_URL (Supabase → Settings → Database → URI) and run: npm run db:patch",
    );
    process.exit(1);
  }

  const pg = await import("pg");
  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.default.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("OK — meeting_bots patched. Retry Join meeting in the app.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
