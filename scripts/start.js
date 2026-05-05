#!/usr/bin/env node
const { execSync, spawnSync } = require("child_process");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Add it in Render → Environment.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const env = { ...process.env };

// Marks the bad SQLite migration as applied so migrate deploy can proceed.
// Safe to run even if _prisma_migrations doesn't exist yet (DO block checks first).
const FIX_SQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
  ) THEN
    -- If the record exists but is in a failed state, mark it as applied
    UPDATE "_prisma_migrations"
    SET finished_at = NOW(),
        logs        = NULL,
        applied_steps_count = 1,
        rolled_back_at = NULL
    WHERE migration_name = '20260426162504_nivarro_core'
      AND (finished_at IS NULL OR logs IS NOT NULL);

    -- If the record doesn't exist at all, insert it as applied
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    SELECT
      'legacy-skipped-001',
      'skipped-sqlite-migration',
      NOW(),
      '20260426162504_nivarro_core',
      NULL, NULL, NOW(), 1
    WHERE NOT EXISTS (
      SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20260426162504_nivarro_core'
    );
  END IF;
END $$;
`;

function fixMigrationState() {
  console.log("→ Fixing legacy SQLite migration state...");
  const result = spawnSync(
    "npx",
    ["prisma", "db", "execute", "--stdin", `--url=${DATABASE_URL}`],
    { input: FIX_SQL, env, encoding: "utf8", stdio: ["pipe", "inherit", "pipe"] }
  );
  if (result.status !== 0) {
    console.error("→ Could not fix migration state:", result.stderr);
    return false;
  }
  console.log("→ Migration state fixed.");
  return true;
}

try {
  console.log("→ Running database migrations...");
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  } catch (_firstErr) {
    console.log("→ First migrate deploy failed — attempting auto-fix...");
    if (fixMigrationState()) {
      console.log("→ Retrying migrate deploy...");
      execSync("npx prisma migrate deploy", { stdio: "inherit", env });
    } else {
      throw new Error("Could not recover from migration failure.");
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
