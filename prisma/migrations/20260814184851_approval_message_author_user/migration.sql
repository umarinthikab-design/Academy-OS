-- DropForeignKey
ALTER TABLE "ApprovalMessage" DROP CONSTRAINT "ApprovalMessage_authorId_fkey";

-- AddForeignKey
ALTER TABLE "ApprovalMessage" ADD CONSTRAINT "ApprovalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
