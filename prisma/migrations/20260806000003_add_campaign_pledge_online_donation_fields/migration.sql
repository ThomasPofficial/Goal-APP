-- Add online mock-donation fields to CampaignPledge, alongside the existing
-- check-pledge fields. Existing rows get status='PLEDGED' (the check flow);
-- new online donations write status='MOCK_COMPLETED' with fee/total set.

ALTER TABLE "CampaignPledge"
  ADD COLUMN IF NOT EXISTS "feeCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "totalCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLEDGED',
  ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;
