#!/usr/bin/env node
const { execSync } = require("child_process");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Add it in Render → Environment.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const env = { ...process.env };

try {
  // The SQLite migration 20260426162504_nivarro_core was mistakenly committed and
  // fails on PostgreSQL. Mark it as applied so migrate deploy can proceed.
  try {
    execSync("npx prisma migrate resolve --applied 20260426162504_nivarro_core", { stdio: "pipe", env });
    console.log("→ Resolved legacy SQLite migration as applied.");
  } catch (_) {
    // Already resolved or not in failed state — safe to ignore.
  }

  console.log("→ Running database migrations...");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });

  console.log("→ Seeding traits...");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
} catch (e) {
  console.error("❌ Startup script failed:", e.message);
  process.exit(1);
}

console.log(`→ Starting Next.js on port ${PORT}...`);
execSync(`npx next start -p ${PORT}`, { stdio: "inherit", env });
