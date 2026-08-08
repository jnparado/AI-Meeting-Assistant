#!/usr/bin/env node
/**
 * Applies supabase/RUN_IN_SQL_EDITOR.sql using a direct Postgres connection.
 *
 * In Supabase: Project Settings → Database → Connection string (URI)
 * Add to .env.local:
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *
 * Then: npm run db:fix
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sqlPath = resolve(root, "supabase/RUN_IN_SQL_EDITOR.sql");

async function main() {
  const url =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!url) {
    console.error(
      "Missing SUPABASE_DB_URL (or DATABASE_URL) in environment.\n" +
        "Supabase → Project Settings → Database → Connection string → URI\n" +
        "Or paste supabase/RUN_IN_SQL_EDITOR.sql into Supabase SQL Editor manually.",
    );
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("Install pg first: npm install pg --save-dev");
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.default.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("OK — MeetMind join SQL applied. Retry Join meeting in the app.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
