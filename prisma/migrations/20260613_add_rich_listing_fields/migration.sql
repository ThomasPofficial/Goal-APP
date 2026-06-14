-- Add new listingStatus column (TEXT, not enum)
ALTER TABLE "OrgProject" ADD COLUMN "listingStatus" TEXT NOT NULL DEFAULT 'OPEN';

-- Copy existing data: OPEN→OPEN, CLOSED→CLOSED, FILLED→CLOSED
UPDATE "OrgProject" SET "listingStatus" =
  CASE
    WHEN status = 'OPEN' THEN 'OPEN'
    WHEN status = 'CLOSED' THEN 'CLOSED'
    WHEN status = 'FILLED' THEN 'CLOSED'
    ELSE 'OPEN'
  END;

-- Drop old status column
ALTER TABLE "OrgProject" DROP COLUMN "status";

-- Drop the enum (only after column is dropped)
DROP TYPE IF EXISTS "OrgProjectStatus";

-- Add all new rich fields
ALTER TABLE "OrgProject"
  ADD COLUMN "locationCity" TEXT,
  ADD COLUMN "locationRequired" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "locationRadius" INTEGER,
  ADD COLUMN "budgetTotal" INTEGER,
  ADD COLUMN "budgetNotes" TEXT,
  ADD COLUMN "toolingStipend" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "toolingAmount" INTEGER,
  ADD COLUMN "gradeEligibility" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "advisorRequired" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "applicationMode" TEXT NOT NULL DEFAULT 'TEAM',
  ADD COLUMN "appMaterials" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "storyBody" TEXT,
  ADD COLUMN "impactStatement" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactRole" TEXT,
  ADD COLUMN "studentOutcomes" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "dayInLife" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "priorTestimonial" TEXT,
  ADD COLUMN "mediaUrls" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "acceptanceRate" DOUBLE PRECISION,
  ADD COLUMN "responseTimeDays" INTEGER,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "lastEditedAt" TIMESTAMP(3);
