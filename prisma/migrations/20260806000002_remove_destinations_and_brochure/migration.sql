-- Remove the school Destinations tab (college-destinations map) and the
-- Brochure feature that lived on the same page (tab retired, school side is
-- now fundraising-focused).
-- Note: does NOT touch Profile.intendedCollege/confirmedCollege/graduationYear
-- etc. — those are general alumni profile fields used elsewhere
-- (AlumniProfileEditor, alumni network), not exclusive to this feature.

DROP TABLE IF EXISTS "StudentBrochureData";
DROP TABLE IF EXISTS "SchoolBrochureSettings";
DROP TABLE IF EXISTS "BrochureTestimonial";
