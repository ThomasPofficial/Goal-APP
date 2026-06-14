ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "animalArchetypes"   TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "archetypeAnalysis"  TEXT,
  ADD COLUMN IF NOT EXISTS "archetypeUpdatedAt" TIMESTAMP(3);
