-- DropForeignKey
ALTER TABLE "Drill" DROP CONSTRAINT "Drill_createdById_fkey";

-- AlterTable
ALTER TABLE "AcademySettings" ADD COLUMN     "clubManagersCanAuthorDrills" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Drill" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Drill" ADD CONSTRAINT "Drill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
