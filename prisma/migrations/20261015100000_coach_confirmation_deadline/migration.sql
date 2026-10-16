-- Additive only: default 24h keeps behaviour sensible for existing rows.
ALTER TABLE "AcademySettings" ADD COLUMN "coachConfirmationDeadlineHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "SessionCoachConfirmation" ADD COLUMN "overdueNotifiedAt" TIMESTAMP(3);
