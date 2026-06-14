-- Add new listingStatus column (TEXT, not enum) — idempotent
ALTER TABLE "OrgProject" ADD COLUMN IF NOT EXISTS "listingStatus" TEXT NOT NULL DEFAULT 'OPEN';

-- Copy existing data only if the old status column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'OrgProject' AND column_name = 'status'
  ) THEN
    UPDATE "OrgProject" SET "listingStatus" =
      CASE
        WHEN status::text = 'OPEN'   THEN 'OPEN'
        WHEN status::text = 'CLOSED' THEN 'CLOSED'
        WHEN status::text = 'FILLED' THEN 'CLOSED'
        ELSE 'OPEN'
      END;
    ALTER TABLE "OrgProject" DROP COLUMN IF EXISTS "status";
  END IF;
END $$;

-- Drop the enum (safe with IF EXISTS)
DROP TYPE IF EXISTS "OrgProjectStatus";

-- Add all new rich fields (idempotent)
ALTER TABLE "OrgProject"
  ADD COLUMN IF NOT EXISTS "locationCity"       TEXT,
  ADD COLUMN IF NOT EXISTS "locationRequired"   TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "locationRadius"     INTEGER,
  ADD COLUMN IF NOT EXISTS "budgetTotal"        INTEGER,
  ADD COLUMN IF NOT EXISTS "budgetNotes"        TEXT,
  ADD COLUMN IF NOT EXISTS "toolingStipend"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "toolingAmount"      INTEGER,
  ADD COLUMN IF NOT EXISTS "gradeEligibility"   TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "advisorRequired"    TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "applicationMode"    TEXT NOT NULL DEFAULT 'TEAM',
  ADD COLUMN IF NOT EXISTS "appMaterials"       TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "storyBody"          TEXT,
  ADD COLUMN IF NOT EXISTS "impactStatement"    TEXT,
  ADD COLUMN IF NOT EXISTS "contactName"        TEXT,
  ADD COLUMN IF NOT EXISTS "contactRole"        TEXT,
  ADD COLUMN IF NOT EXISTS "studentOutcomes"    TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "dayInLife"          TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "priorTestimonial"   TEXT,
  ADD COLUMN IF NOT EXISTS "mediaUrls"          TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "acceptanceRate"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "responseTimeDays"   INTEGER,
  ADD COLUMN IF NOT EXISTS "publishedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEditedAt"       TIMESTAMP(3);
