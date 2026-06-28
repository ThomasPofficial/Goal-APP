-- School Mock Hour 2: Alumni flags, mentor toggle, campaign pledges
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isAlumni" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "isAvailableToMentor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "industry"             TEXT;

CREATE TABLE IF NOT EXISTS "CampaignPledge" (
  "id"           TEXT        NOT NULL,
  "causeText"    TEXT,
  "donorName"    TEXT        NOT NULL,
  "donorEmail"   TEXT        NOT NULL,
  "donorPhone"   TEXT,
  "pledgeAmount" DECIMAL(10,2),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignPledge_pkey" PRIMARY KEY ("id")
);
