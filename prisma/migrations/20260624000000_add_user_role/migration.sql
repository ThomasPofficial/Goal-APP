-- UserRole: explicit account type on every user — STUDENT (default), ORG, ADMIN
-- Replaces fragile org-ownership lookup for sidebar identity determination.
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ORG', 'ADMIN');
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'STUDENT';
