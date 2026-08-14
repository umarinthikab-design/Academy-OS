-- CreateEnum
CREATE TYPE "AgeGroupCategory" AS ENUM ('LITTLE_LEAGUE', 'JUNIOR_VARSITY');

-- AlterTable
ALTER TABLE "AgeGroup" ADD COLUMN     "category" "AgeGroupCategory" NOT NULL DEFAULT 'JUNIOR_VARSITY';
