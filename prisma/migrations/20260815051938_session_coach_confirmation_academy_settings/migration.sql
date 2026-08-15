-- CreateEnum
CREATE TYPE "CoachConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateTable
CREATE TABLE "SessionCoachConfirmation" (
    "id" TEXT NOT NULL,
    "scheduledSessionId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "status" "CoachConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionCoachConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademySettings" (
    "id" TEXT NOT NULL,
    "preSessionConfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "confirmationWindowHours" INTEGER NOT NULL DEFAULT 72,
    "priorityWindowHours" INTEGER NOT NULL DEFAULT 48,

    CONSTRAINT "AcademySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionCoachConfirmation_scheduledSessionId_coachId_key" ON "SessionCoachConfirmation"("scheduledSessionId", "coachId");

-- AddForeignKey
ALTER TABLE "SessionCoachConfirmation" ADD CONSTRAINT "SessionCoachConfirmation_scheduledSessionId_fkey" FOREIGN KEY ("scheduledSessionId") REFERENCES "ScheduledSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCoachConfirmation" ADD CONSTRAINT "SessionCoachConfirmation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
