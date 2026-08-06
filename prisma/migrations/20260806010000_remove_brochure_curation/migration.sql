-- Remove the school-admin Brochure Curation subsystem (settings + testimonials).
-- Note: does NOT touch StudentBrochureData or Profile.brochureData — that's the
-- alumni "Your Outcomes" survey form's data sink, a separate feature, untouched.

DROP TABLE IF EXISTS "BrochureTestimonial";
DROP TABLE IF EXISTS "SchoolBrochureSettings";
