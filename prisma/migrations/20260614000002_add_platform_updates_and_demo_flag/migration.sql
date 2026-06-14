-- isDemo flag on Profile: marks seed/bot accounts, filtered from peers listing
ALTER TABLE "Profile" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- PlatformUpdate: platform announcements posted by team@nivarro.co, shown after WelcomeCard
CREATE TABLE "PlatformUpdate" (
    "id"        TEXT        NOT NULL,
    "title"     TEXT        NOT NULL,
    "body"      TEXT        NOT NULL,
    "emoji"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformUpdate_pkey" PRIMARY KEY ("id")
);
