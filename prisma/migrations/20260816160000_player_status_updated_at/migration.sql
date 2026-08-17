-- Track when a player's status last changed so the UI can nudge coaches
-- when an INJURED/SUSPENDED flag has gone stale. Existing rows get their
-- creation time (read as "never flagged"); from here on updatePlayerStatus
-- bumps it on every change.

ALTER TABLE "Player" ADD COLUMN "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;