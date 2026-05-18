-- AlterTable: Add apiKey to Org for agent API authentication
ALTER TABLE "Org"
  ADD COLUMN IF NOT EXISTS "apiKey" TEXT;

-- CreateIndex: unique constraint on apiKey
CREATE UNIQUE INDEX IF NOT EXISTS "Org_apiKey_key" ON "Org"("apiKey");
