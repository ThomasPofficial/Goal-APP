-- Remove the annual-survey-email invite flow and its dead tracking column.
-- StudentBrochureData itself (college/jobTitle/employer/etc.) stays — it's
-- the live data source for brochure curation and the "Why {school}" stats.

ALTER TABLE "StudentBrochureData"
  DROP COLUMN IF EXISTS "lastEmailedAt";
