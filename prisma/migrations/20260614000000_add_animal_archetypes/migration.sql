ALTER TABLE "Profile"
  ADD COLUMN "animalArchetypes" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "archetypeAnalysis" TEXT,
  ADD COLUMN "archetypeUpdatedAt" TIMESTAMP(3);
