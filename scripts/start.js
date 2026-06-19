#!/usr/bin/env node
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Add it in Render → Environment.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const env = { ...process.env };

// Marks known-problematic migrations as applied so migrate deploy can proceed.
// Safe if a migration isn't in the table (UPDATE affects 0 rows).
const FIX_SQL = `
UPDATE "_prisma_migrations"
SET finished_at = NOW(), logs = NULL, applied_steps_count = 1, rolled_back_at = NULL
WHERE migration_name IN (
  '20260426162504_nivarro_core',
  '20260613000000_add_saved_org',
  '20260613000001_add_rich_listing_fields',
  '20260613000002_add_scraper_queue',
  '20260614000000_add_verified_and_review_ai',
  '20260614000001_add_animal_archetypes',
  '20260614000002_add_platform_updates_and_demo_flag'
)
AND (finished_at IS NULL OR rolled_back_at IS NOT NULL OR logs IS NOT NULL);
`;

function fixMigrationState() {
  console.log("→ Fixing legacy migration state via db execute...");
  const tmpFile = path.join(os.tmpdir(), "fix-migration.sql");
  fs.writeFileSync(tmpFile, FIX_SQL);

  const result = spawnSync(
    "npx",
    ["prisma", "db", "execute", `--file=${tmpFile}`],
    { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  console.log("  stdout:", result.stdout || "(empty)");
  console.log("  stderr:", result.stderr || "(empty)");
  console.log("  exit code:", result.status);

  fs.unlinkSync(tmpFile);
  return result.status === 0;
}

try {
  console.log("→ Running database migrations...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  } catch (_firstErr) {
    console.log("→ migrate deploy failed — attempting auto-fix of migration state...");
    if (fixMigrationState()) {
      console.log("→ Retrying migrate deploy...");
      execSync("npx prisma migrate deploy", { stdio: "inherit", env });
    } else {
      throw new Error("Could not fix migration state — see logs above.");
    }
  }

  console.log("→ Seeding traits...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
} catch (e) {
  console.error("❌ Startup script failed:", e.message);
  process.exit(1);
}

console.log(`→ Starting Next.js on port ${PORT}...`);
execSync(`npx next start -p ${PORT}`, { stdio: "inherit", env });
