-- Rename PlayerAvailability -> PlayerStatus (AVAILABLE becomes ACTIVE, add SUSPENDED)
-- and Player.availability -> Player.status, preserving existing values.

-- 1. New enum with the added SUSPENDED value
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'INJURED', 'SUSPENDED', 'INACTIVE');

-- 2. New column with a temporary name so we can map data across safely
ALTER TABLE "Player" ADD COLUMN "status_tmp" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE';

-- 3. Migrate existing values (AVAILABLE maps to ACTIVE; INJURED/INACTIVE are unchanged)
UPDATE "Player"
SET "status_tmp" = CASE "availability"
  WHEN 'AVAILABLE' THEN 'ACTIVE'::"PlayerStatus"
  WHEN 'INJURED' THEN 'INJURED'::"PlayerStatus"
  WHEN 'INACTIVE' THEN 'INACTIVE'::"PlayerStatus"
  ELSE 'ACTIVE'::"PlayerStatus"
END;

-- 4. Swap columns
ALTER TABLE "Player" DROP COLUMN "availability";
ALTER TABLE "Player" RENAME COLUMN "status_tmp" TO "status";

-- 5. Drop the old enum now that nothing references it
DROP TYPE "PlayerAvailability";

-- 6. Coach archiving flag
ALTER TABLE "Coach" ADD COLUMN "archivedAt" TIMESTAMP(3);
