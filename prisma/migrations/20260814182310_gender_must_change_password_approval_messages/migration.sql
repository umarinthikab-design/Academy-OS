-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ApprovalMessage" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApprovalMessage" ADD CONSTRAINT "ApprovalMessage_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalMessage" ADD CONSTRAINT "ApprovalMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
