-- Partnership Requests: student-initiated group requests to alumni/staff/students at their school

DO $$ BEGIN
  CREATE TYPE "PartnershipRequestStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'EXPIRED_EMPTY', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PartnershipInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PartnershipRequest" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "fromUserId"  TEXT NOT NULL,
  "message"     TEXT,
  "status"      "PartnershipRequestStatus" NOT NULL DEFAULT 'PENDING',
  "roomId"      TEXT,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt" TIMESTAMP(3),
  CONSTRAINT "PartnershipRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnershipRequest_schoolId_status_idx" ON "PartnershipRequest"("schoolId", "status");

CREATE TABLE IF NOT EXISTS "PartnershipInvite" (
  "id"          TEXT NOT NULL,
  "requestId"   TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "status"      "PartnershipInviteStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "PartnershipInvite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnershipInvite_requestId_idx" ON "PartnershipInvite"("requestId");
CREATE INDEX IF NOT EXISTS "PartnershipInvite_userId_status_idx" ON "PartnershipInvite"("userId", "status");

DO $$ BEGIN
  ALTER TABLE "PartnershipInvite" ADD CONSTRAINT "PartnershipInvite_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "PartnershipRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
