CREATE TABLE IF NOT EXISTS "StudentBrochureData" (
  "id"              TEXT NOT NULL,
  "profileId"       TEXT NOT NULL,
  "college"         TEXT,
  "jobTitle"        TEXT,
  "employer"        TEXT,
  "internshipTitle" TEXT,
  "internshipOrg"   TEXT,
  "lastEmailedAt"   TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentBrochureData_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentBrochureData_profileId_key"
  ON "StudentBrochureData"("profileId");
ALTER TABLE "StudentBrochureData"
  ADD CONSTRAINT "StudentBrochureData_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SchoolBrochureSettings" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "visibility"  TEXT NOT NULL DEFAULT 'ADMIN_ONLY',
  "maxStudents" INTEGER,
  "excludedIds" TEXT NOT NULL DEFAULT '[]',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolBrochureSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolBrochureSettings_schoolId_key"
  ON "SchoolBrochureSettings"("schoolId");

CREATE TABLE IF NOT EXISTS "BrochureTestimonial" (
  "id"            TEXT NOT NULL,
  "schoolId"      TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "sourceName"    TEXT NOT NULL,
  "sourceContext" TEXT,
  "sourceType"    TEXT NOT NULL DEFAULT 'STUDENT',
  "approved"      BOOLEAN NOT NULL DEFAULT false,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrochureTestimonial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BrochureTestimonial_schoolId_idx" ON "BrochureTestimonial"("schoolId");
