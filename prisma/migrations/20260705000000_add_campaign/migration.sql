-- Create Campaign table
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT,
  "schoolId"    TEXT NOT NULL,
  "cause"       TEXT NOT NULL,
  "headline"    TEXT NOT NULL,
  "subheadline" TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "ctaText"     TEXT NOT NULL,
  "imageParams" JSONB NOT NULL,
  "videoUrl"    TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_slug_key" ON "Campaign"("slug");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Campaign_schoolId_fkey'
  ) THEN
    ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Create CampaignVersion table
CREATE TABLE IF NOT EXISTS "CampaignVersion" (
  "id"           TEXT NOT NULL,
  "campaignId"   TEXT NOT NULL,
  "cause"        TEXT NOT NULL,
  "headline"     TEXT NOT NULL,
  "subheadline"  TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "ctaText"      TEXT NOT NULL,
  "imageParams"  JSONB NOT NULL,
  "restoredFrom" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignVersion_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CampaignVersion_campaignId_fkey'
  ) THEN
    ALTER TABLE "CampaignVersion" ADD CONSTRAINT "CampaignVersion_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add campaignId to CampaignPledge
ALTER TABLE "CampaignPledge" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CampaignPledge_campaignId_fkey'
  ) THEN
    ALTER TABLE "CampaignPledge" ADD CONSTRAINT "CampaignPledge_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
