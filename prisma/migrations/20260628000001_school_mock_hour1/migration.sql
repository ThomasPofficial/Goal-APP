-- School Mock Hour 1: College destination fields on Profile
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "intendedCollege" TEXT,
  ADD COLUMN IF NOT EXISTS "intendedMajor"   TEXT,
  ADD COLUMN IF NOT EXISTS "graduationYear"  INTEGER;
