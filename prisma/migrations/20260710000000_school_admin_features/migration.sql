-- Admin/Teacher (SCHOOL role) UI additions: quiz toggle + mentorship pairing conversations

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "schoolQuizEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'MENTORSHIP';
