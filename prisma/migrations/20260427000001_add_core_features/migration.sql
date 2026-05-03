-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP', 'TEAM');

-- CreateEnum
CREATE TYPE "OrgCategory" AS ENUM ('ACCELERATOR', 'FELLOWSHIP', 'INTERNSHIP', 'COMPETITION', 'BOOTCAMP', 'RESEARCH', 'CLUB');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('OPEN', 'CLOSED', 'ROLLING');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "NoteboardType" AS ENUM ('NOTE', 'TASK', 'CHECKLIST');

-- AlterTable Profile (add columns not in init migration)
ALTER TABLE "Profile"
  ADD COLUMN "secondaryGeniusType" "GeniusType",
  ADD COLUMN "handle" TEXT,
  ADD COLUMN "currentFocus" TEXT,
  ADD COLUMN "interests" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "grade" INTEGER,
  ADD COLUMN "schoolName" TEXT,
  ADD COLUMN "isFirstGen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isHomeschooled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isInternational" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_handle_key" ON "Profile"("handle");

-- AlterTable Conversation (add type and teamId)
ALTER TABLE "Conversation"
  ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "teamId" TEXT;

-- CreateTable Org
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "whatWeSeek" TEXT,
    "category" "OrgCategory" NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'OPEN',
    "heroUrl" TEXT,
    "accentColor" TEXT,
    "minTeamSize" INTEGER NOT NULL DEFAULT 1,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 5,
    "gradeEligibility" TEXT,
    "deadline" TIMESTAMP(3),
    "format" TEXT,
    "location" TEXT,
    "stipend" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable Opportunity
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "OrgCategory" NOT NULL,
    "deadline" TIMESTAMP(3),
    "gradeEligibility" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable SavedOpportunity
CREATE TABLE "SavedOpportunity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable Contact
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable Team
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "orgId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable TeamMember
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable NoteboardCard
CREATE TABLE "NoteboardCard" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" "NoteboardType" NOT NULL,
    "payload" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NoteboardCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_profileId_opportunityId_key" ON "SavedOpportunity"("profileId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_targetId_key" ON "Contact"("ownerId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_profileId_key" ON "TeamMember"("teamId", "profileId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteboardCard" ADD CONSTRAINT "NoteboardCard_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
