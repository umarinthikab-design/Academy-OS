-- Add timeZone field to AcademySettings for wall-clock time interpretation.
-- IANA timezone string (e.g. "America/New_York", "Europe/London", "UTC").
-- Default "UTC" preserves existing behavior; compute helpers read this value
-- and apply the offset when interpreting session startTime / deadline / "today" filters.
ALTER TABLE "AcademySettings" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC';