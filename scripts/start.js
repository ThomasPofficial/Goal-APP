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
