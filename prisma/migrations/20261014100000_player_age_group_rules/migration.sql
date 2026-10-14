-- Additive only: existing player assignments stay nullable. No birth-date rules
-- are guessed, and automatic assignment remains disabled until configured.
ALTER TABLE "AcademySettings" ADD COLUMN "autoAssignPlayerAgeGroup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AgeGroup" ADD COLUMN "birthDateFrom" DATE, ADD COLUMN "birthDateTo" DATE;
ALTER TABLE "Player" ADD COLUMN "ageGroupId" TEXT;
CREATE INDEX "Player_ageGroupId_idx" ON "Player"("ageGroupId");
ALTER TABLE "Player" ADD CONSTRAINT "Player_ageGroupId_fkey" FOREIGN KEY ("ageGroupId") REFERENCES "AgeGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgeGroup" ADD CONSTRAINT "AgeGroup_birth_date_range_check" CHECK (("birthDateFrom" IS NULL AND "birthDateTo" IS NULL) OR ("birthDateFrom" IS NOT NULL AND "birthDateTo" IS NOT NULL AND "birthDateFrom" <= "birthDateTo"));
