-- Add whatInternsBuild and contactEmail to Org
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "whatInternsBuild" TEXT;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

-- Add closedAt and outcomeNote to OrgProject
ALTER TABLE "OrgProject" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "OrgProject" ADD COLUMN IF NOT EXISTS "outcomeNote" TEXT;
