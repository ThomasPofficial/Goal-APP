-- Label every CampaignVersion snapshot with how it was produced, so the
-- version history UI can show "Generated" / "Tweaked: <feedback>" /
-- "Manual edit" / "Restored" instead of a bare headline + timestamp.

ALTER TABLE "CampaignVersion" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'generate';
ALTER TABLE "CampaignVersion" ADD COLUMN IF NOT EXISTS "note" TEXT;
