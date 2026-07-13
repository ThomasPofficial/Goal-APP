-- Removed the per-school genius-type quiz opt-in — school-affiliated students
-- are now walled off from the quiz unconditionally, no admin override.

ALTER TABLE "User" DROP COLUMN IF EXISTS "schoolQuizEnabled";
