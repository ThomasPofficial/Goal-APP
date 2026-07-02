-- Add COMMUNITY value to ConversationType enum
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL
ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'COMMUNITY';

-- Add columns to Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isPrivateRoom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "communityName" TEXT;

-- Add phone to Profile
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Add schoolCode to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_schoolCode_key" ON "User"("schoolCode");
