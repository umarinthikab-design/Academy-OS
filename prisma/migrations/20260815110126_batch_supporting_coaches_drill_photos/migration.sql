-- CreateTable
CREATE TABLE "DrillPhoto" (
    "id" TEXT NOT NULL,
    "drillId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DrillPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BatchSupportingCoaches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BatchSupportingCoaches_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BatchSupportingCoaches_B_index" ON "_BatchSupportingCoaches"("B");

-- AddForeignKey
ALTER TABLE "DrillPhoto" ADD CONSTRAINT "DrillPhoto_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchSupportingCoaches" ADD CONSTRAINT "_BatchSupportingCoaches_A_fkey" FOREIGN KEY ("A") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchSupportingCoaches" ADD CONSTRAINT "_BatchSupportingCoaches_B_fkey" FOREIGN KEY ("B") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
