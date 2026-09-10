-- CreateTable
CREATE TABLE "AgeGroupCategoryOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AgeGroupCategoryOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgeGroupCategoryOption_name_key" ON "AgeGroupCategoryOption"("name");

-- Seed the two existing enum values as real rows, matching current data.
INSERT INTO "AgeGroupCategoryOption" ("id", "name", "sortOrder") VALUES
    ('cat_little_league', 'Little League', 0),
    ('cat_junior_varsity', 'Junior Varsity', 1);

-- AlterTable: add categoryId nullable first so we can backfill from the old
-- enum column before making it required.
ALTER TABLE "AgeGroup" ADD COLUMN "categoryId" TEXT;

-- Backfill every existing AgeGroup row from its old enum value.
UPDATE "AgeGroup" SET "categoryId" = CASE "category"
    WHEN 'LITTLE_LEAGUE' THEN 'cat_little_league'
    WHEN 'JUNIOR_VARSITY' THEN 'cat_junior_varsity'
END;

-- Now that every row has a categoryId, enforce NOT NULL and drop the old
-- enum column + type.
ALTER TABLE "AgeGroup" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "AgeGroup" DROP COLUMN "category";
DROP TYPE "AgeGroupCategory";

-- AddForeignKey
ALTER TABLE "AgeGroup" ADD CONSTRAINT "AgeGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AgeGroupCategoryOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
