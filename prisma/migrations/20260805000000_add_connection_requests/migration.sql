-- School Connections: student/alumni -> alumni/teacher 1:1 request, teacher-approved private room

CREATE TYPE "ConnectionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE IF NOT EXISTS "ConnectionRequest" (
  "id"          TEXT NOT NULL,
  "schoolId"    TEXT NOT NULL,
  "fromUserId"  TEXT NOT NULL,
  "toUserId"    TEXT NOT NULL,
  "status"      "ConnectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "roomId"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConnectionRequest_schoolId_status_idx" ON "ConnectionRequest"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "ConnectionRequest_toUserId_idx" ON "ConnectionRequest"("toUserId");
