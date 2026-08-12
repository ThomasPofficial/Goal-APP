-- Faculty permission tiers: FacultyTier, Profile permission/invite fields

CREATE TABLE IF NOT EXISTS "FacultyTier" (
  "id"              TEXT NOT NULL,
  "schoolId"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "permissions"     TEXT NOT NULL DEFAULT '[]',
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FacultyTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FacultyTier_schoolId_idx" ON "FacultyTier"("schoolId");

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffTierId" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffPermissionOverrides" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "staffInvited" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "Profile" ADD CONSTRAINT "Profile_staffTierId_fkey"
    FOREIGN KEY ("staffTierId") REFERENCES "FacultyTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
