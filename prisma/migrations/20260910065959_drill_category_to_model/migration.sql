-- CreateTable
CREATE TABLE "DrillCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DrillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrillCategory_name_key" ON "DrillCategory"("name");

-- Seed the six previously-hardcoded category names as real rows, matching
-- current data exactly (values used to come from the CATEGORIES constant in
-- app/drills/page.tsx).
INSERT INTO "DrillCategory" ("id", "name", "sortOrder") VALUES
    ('drc_warm_up', 'Warm-up', 0),
    ('drc_passing', 'Passing', 1),
    ('drc_dribbling', 'Dribbling', 2),
    ('drc_shooting', 'Shooting', 3),
    ('drc_defending', 'Defending', 4),
    ('drc_fun_game', 'Fun Game', 5);

-- AlterTable: add categoryId nullable first so we can backfill from the old
-- string column before making it required.
ALTER TABLE "Drill" ADD COLUMN "categoryId" TEXT;

-- Backfill every existing Drill row by matching its old category string to
-- the new row with the same name.
UPDATE "Drill" d SET "categoryId" = dc."id"
FROM "DrillCategory" dc
WHERE dc."name" = d."category";

-- Any drill whose old category string didn't match one of the six known
-- values (a stray/legacy value) falls back to the first category rather
-- than being left with a null FK.
UPDATE "Drill" SET "categoryId" = 'drc_warm_up' WHERE "categoryId" IS NULL;

-- Now that every row has a categoryId, enforce NOT NULL and drop the old
-- string column.
ALTER TABLE "Drill" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Drill" DROP COLUMN "category";

-- AddForeignKey
ALTER TABLE "Drill" ADD CONSTRAINT "Drill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DrillCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
