-- Additive only: advance player RSVP stays off until enabled in Club Settings.
ALTER TABLE "AcademySettings" ADD COLUMN "playerAdvanceRsvpEnabled" BOOLEAN NOT NULL DEFAULT false;
