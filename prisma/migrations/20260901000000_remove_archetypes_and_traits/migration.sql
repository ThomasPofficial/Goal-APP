-- Remove the Trait/ProfileTrait/PeerEndorsement/PeerEndorsedTrait tables and the
-- Animal Archetype columns entirely — both features have been fully removed from
-- the codebase (Tasks 1-11 of the remove-archetypes-and-traits plan); this drops
-- their remaining data and schema footprint. Hand-authored (not machine-generated)
-- because `prisma migrate dev`'s shadow-database replay hits an unrelated
-- pre-existing migration-history ordering bug (see task-12-report.md), and
-- `prisma migrate diff --from-config-datasource` pulls in unrelated pre-existing
-- DB drift (Achievement/ProfileHighlight/SupportTicket/connect_signups/
-- SupportTicketStatus/Campaign.updatedAt/WorkflowSession.updatedAt) that is out
-- of scope for this task and is being tracked/flagged separately.

DROP TABLE IF EXISTS "ProfileTrait";
DROP TABLE IF EXISTS "PeerEndorsedTrait";
DROP TABLE IF EXISTS "PeerEndorsement";
DROP TABLE IF EXISTS "Trait";

ALTER TABLE "Profile"
  DROP COLUMN IF EXISTS "animalArchetypes",
  DROP COLUMN IF EXISTS "archetypeAnalysis",
  DROP COLUMN IF EXISTS "archetypeUpdatedAt";

DROP TYPE IF EXISTS "TraitCategory";
