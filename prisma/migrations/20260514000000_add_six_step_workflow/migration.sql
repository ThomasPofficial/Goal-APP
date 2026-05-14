-- AlterEnum: Add ACCEPTED to TeamStatus
ALTER TYPE "TeamStatus" ADD VALUE 'ACCEPTED';

-- CreateEnum
CREATE TYPE "OrgProjectStatus" AS ENUM ('OPEN', 'CLOSED', 'FILLED');

-- CreateEnum
CREATE TYPE "RecruitmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable OrgProject
CREATE TABLE "OrgProject" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "openSpots" INTEGER NOT NULL DEFAULT 1,
    "requiredSkills" TEXT NOT NULL DEFAULT '[]',
    "deadline" TIMESTAMP(3),
    "status" "OrgProjectStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable RecruitmentRequest
CREATE TABLE "RecruitmentRequest" (
    "id" TEXT NOT NULL,
    "orgProjectId" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "message" TEXT,
    "status" "RecruitmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable TeamApplication
CREATE TABLE "TeamApplication" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "orgProjectId" TEXT NOT NULL,
    "whyJoin" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TeamApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentRequest_orgProjectId_fromProfileId_toProfileId_key" ON "RecruitmentRequest"("orgProjectId", "fromProfileId", "toProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamApplication_teamId_orgProjectId_key" ON "TeamApplication"("teamId", "orgProjectId");

-- AddForeignKey
ALTER TABLE "OrgProject" ADD CONSTRAINT "OrgProject_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_orgProjectId_fkey" FOREIGN KEY ("orgProjectId") REFERENCES "OrgProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_fromProfileId_fkey" FOREIGN KEY ("fromProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_toProfileId_fkey" FOREIGN KEY ("toProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitmentRequest" ADD CONSTRAINT "RecruitmentRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamApplication" ADD CONSTRAINT "TeamApplication_orgProjectId_fkey" FOREIGN KEY ("orgProjectId") REFERENCES "OrgProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
