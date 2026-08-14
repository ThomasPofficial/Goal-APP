-- These columns exist in prisma/schema.prisma and are actively used by
-- lib/runArchetypeAnalysis.ts, components/AnimalArchetypeCard.tsx, and the
-- profile page, but were found missing from the live database on 2026-08-13
-- (crashing prisma/seed.ts's Profile upserts with P2022 ColumnNotFound, and
-- by extension any Profile.create()/.upsert() in the app, since the schema
-- default for animalArchetypes is applied to every insert). No migration in
-- this repo ever dropped them — this restores parity between schema.prisma
-- and the database. If this was an intentional removal by someone working
-- outside a tracked migration, this should be reverted deliberately instead.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "animalArchetypes"   TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "archetypeAnalysis"  TEXT,
  ADD COLUMN IF NOT EXISTS "archetypeUpdatedAt" TIMESTAMP(3);
