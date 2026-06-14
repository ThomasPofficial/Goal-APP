CREATE TABLE "ScrapedListing" (
  "id" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceInstitution" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "rawDescription" TEXT NOT NULL,
  "deadline" TEXT,
  "aiSummary" TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "aiApproved" BOOLEAN,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrapedListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ScrapedListing_status_idx" ON "ScrapedListing"("status");
