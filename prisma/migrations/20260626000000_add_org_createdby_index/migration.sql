-- Index on Org.createdById — turns the per-page-load org lookup into an O(1)
-- seek regardless of how many orgs exist in the database.
CREATE INDEX IF NOT EXISTS "Org_createdById_idx" ON "Org"("createdById");
