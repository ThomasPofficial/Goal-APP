-- Add alumni destination tracking columns to Profile
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "linkedinUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "employer"           TEXT,
  ADD COLUMN IF NOT EXISTS "jobTitle"           TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedCollege"   TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedMajor"     TEXT,
  ADD COLUMN IF NOT EXISTS "lastLinkedinScan"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "linkedinScanOptOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "surveyOptOut"       BOOLEAN NOT NULL DEFAULT false;

-- SurveyToken table
CREATE TABLE IF NOT EXISTS "SurveyToken" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "year"        INTEGER NOT NULL,
  "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "prefillData" TEXT,
  CONSTRAINT "SurveyToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyToken_token_key"       ON "SurveyToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "SurveyToken_userId_year_key" ON "SurveyToken"("userId", "year");
CREATE INDEX        IF NOT EXISTS "SurveyToken_userId_idx"      ON "SurveyToken"("userId");

ALTER TABLE "SurveyToken"
  ADD CONSTRAINT "SurveyToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LinkedinScanEvent table
CREATE TABLE IF NOT EXISTS "LinkedinScanEvent" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "field"     TEXT NOT NULL,
  "prevValue" TEXT,
  "newValue"  TEXT,
  "notified"  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "LinkedinScanEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LinkedinScanEvent_userId_idx"     ON "LinkedinScanEvent"("userId");
CREATE INDEX IF NOT EXISTS "LinkedinScanEvent_scannedAt_idx"  ON "LinkedinScanEvent"("scannedAt");

ALTER TABLE "LinkedinScanEvent"
  ADD CONSTRAINT "LinkedinScanEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
