-- AlterTable: Add paid tier + visual identity fields to Org
ALTER TABLE "Org"
  ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "logoLetter" TEXT,
  ADD COLUMN IF NOT EXISTS "logoBg" TEXT,
  ADD COLUMN IF NOT EXISTS "logoColor" TEXT,
  ADD COLUMN IF NOT EXISTS "bannerGradient" TEXT,
  ADD COLUMN IF NOT EXISTS "founded" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "orgType" TEXT,
  ADD COLUMN IF NOT EXISTS "values" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "socialProof" TEXT,
  ADD COLUMN IF NOT EXISTS "focusTags" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "memberCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "headquartersLocation" TEXT;

-- AlterTable: Add project detail fields to OrgProject
ALTER TABLE "OrgProject"
  ADD COLUMN IF NOT EXISTS "shortDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "fullDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredGeniusTypes" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "roles" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "hoursPerWeek" TEXT,
  ADD COLUMN IF NOT EXISTS "duration" TEXT,
  ADD COLUMN IF NOT EXISTS "format" TEXT,
  ADD COLUMN IF NOT EXISTS "progressPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable OrgReview
CREATE TABLE IF NOT EXISTS "OrgReview" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orgProjectId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable WorkflowSession
CREATE TABLE IF NOT EXISTS "WorkflowSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orgProjectId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "teamId" TEXT,
    "rosterLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable AlgorithmQuota
CREATE TABLE IF NOT EXISTS "AlgorithmQuota" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orgProjectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AlgorithmQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrgReview_orgProjectId_profileId_key" ON "OrgReview"("orgProjectId", "profileId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowSession_profileId_key" ON "WorkflowSession"("profileId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowSession_teamId_key" ON "WorkflowSession"("teamId");
CREATE UNIQUE INDEX IF NOT EXISTS "AlgorithmQuota_profileId_orgProjectId_date_key" ON "AlgorithmQuota"("profileId", "orgProjectId", "date");

-- AddForeignKey
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_orgProjectId_fkey"
  FOREIGN KEY ("orgProjectId") REFERENCES "OrgProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgReview" ADD CONSTRAINT "OrgReview_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowSession" ADD CONSTRAINT "WorkflowSession_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowSession" ADD CONSTRAINT "WorkflowSession_orgProjectId_fkey"
  FOREIGN KEY ("orgProjectId") REFERENCES "OrgProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowSession" ADD CONSTRAINT "WorkflowSession_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlgorithmQuota" ADD CONSTRAINT "AlgorithmQuota_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlgorithmQuota" ADD CONSTRAINT "AlgorithmQuota_orgProjectId_fkey"
  FOREIGN KEY ("orgProjectId") REFERENCES "OrgProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
