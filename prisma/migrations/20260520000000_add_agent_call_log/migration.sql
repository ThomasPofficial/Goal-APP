-- CreateTable AgentCallLog (agent rate limiting: 100 calls/day per paid org)
CREATE TABLE IF NOT EXISTS "AgentCallLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgentCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgentCallLog_orgId_date_key" ON "AgentCallLog"("orgId", "date");

-- AddForeignKey
ALTER TABLE "AgentCallLog" ADD CONSTRAINT "AgentCallLog_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
