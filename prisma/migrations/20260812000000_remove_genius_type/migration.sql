-- Removed the Genius Type feature entirely — student profiles and org
-- project preferences no longer track a genius type; the enum itself
-- is dropped now that no column references it.

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "geniusType";
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "secondaryGeniusType";

ALTER TABLE "OrgProject" DROP COLUMN IF EXISTS "preferredGeniusTypes";

DROP TYPE IF EXISTS "GeniusType";
