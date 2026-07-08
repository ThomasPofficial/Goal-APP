-- Add advancementEmail to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "advancementEmail" TEXT;

-- Add goalAmount and manualAdjustment to Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "goalAmount" DECIMAL(10,2);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "manualAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0;
