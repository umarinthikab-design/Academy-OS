/*
  Warnings:

  - You are about to drop the column `archivedAt` on the `Coach` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLUB_MANAGER';

-- Carry archived coach flags over to their User rows before the Coach
-- column disappears.
ALTER TABLE "User" ADD COLUMN     "archivedAt" TIMESTAMP(3);

UPDATE "User" u
SET "archivedAt" = c."archivedAt"
FROM "Coach" c
WHERE c."userId" = u.id AND c."archivedAt" IS NOT NULL;

-- AlterTable
ALTER TABLE "Coach" DROP COLUMN "archivedAt";
