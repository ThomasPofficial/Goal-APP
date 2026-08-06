-- Remove the senior destination survey / LinkedIn-scan feature (tab retired).
-- Note: does NOT touch Profile.linkedinUrl/employer/jobTitle/confirmedCollege/
-- confirmedMajor — those are general alumni profile fields used elsewhere
-- (AlumniProfileEditor, brochure outcomes form), not exclusive to this feature.

DROP TABLE IF EXISTS "LinkedinScanEvent";
DROP TABLE IF EXISTS "SurveyToken";

ALTER TABLE "Profile"
  DROP COLUMN IF EXISTS "lastLinkedinScan",
  DROP COLUMN IF EXISTS "linkedinScanOptOut",
  DROP COLUMN IF EXISTS "surveyOptOut";
