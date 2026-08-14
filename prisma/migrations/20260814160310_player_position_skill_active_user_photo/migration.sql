-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "position" TEXT NOT NULL DEFAULT 'Unassigned (Default)';

-- AlterTable
ALTER TABLE "PlayerSkill" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoUrl" TEXT;
