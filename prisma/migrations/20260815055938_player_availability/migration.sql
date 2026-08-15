-- CreateEnum
CREATE TYPE "PlayerAvailability" AS ENUM ('AVAILABLE', 'INJURED', 'INACTIVE');

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "availability" "PlayerAvailability" NOT NULL DEFAULT 'AVAILABLE';
