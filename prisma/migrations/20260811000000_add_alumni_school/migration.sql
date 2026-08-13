-- Alumni multi-school support: an alum can be linked to 0-to-many schools.
-- Profile.schoolId remains the single-school field for non-alumni Students.

CREATE TABLE IF NOT EXISTS "AlumniSchool" (
  "id"        TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "schoolId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlumniSchool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlumniSchool_profileId_schoolId_key" ON "AlumniSchool"("profileId", "schoolId");
CREATE INDEX IF NOT EXISTS "AlumniSchool_schoolId_idx" ON "AlumniSchool"("schoolId");

DO $$ BEGIN
  ALTER TABLE "AlumniSchool" ADD CONSTRAINT "AlumniSchool_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
