/*
  Warnings:

  - You are about to drop the column `endDate` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `eventType` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionPlan` on the `School` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Slot` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Slot` table. All the data in the column will be lost.
  - You are about to drop the column `keycloakUserId` on the `Teacher` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Teacher` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `Teacher` table. All the data in the column will be lost.
  - Added the required column `parentSurname` to the `Booking` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Slot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time` to the `Slot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eventId` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `surname` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Teacher_keycloakUserId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "childClass" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "numberOfPersons" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "parentFirstName" TEXT,
ADD COLUMN     "parentSurname" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "salutation" TEXT,
ADD COLUMN     "secondPersonFirstName" TEXT,
ADD COLUMN     "secondPersonSalutation" TEXT,
ADD COLUMN     "secondPersonSurname" TEXT;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "endDate",
DROP COLUMN "eventType",
DROP COLUMN "startDate",
DROP COLUMN "title",
ADD COLUMN     "bookingActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "breakLength" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "date" TEXT NOT NULL,
ADD COLUMN     "endTime" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "sessionLength" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "startTime" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'SLOT_BOOKING',
ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "School" DROP COLUMN "address",
DROP COLUMN "subscriptionPlan",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Slot" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "date" TEXT NOT NULL,
ADD COLUMN     "time" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" DROP COLUMN "keycloakUserId",
DROP COLUMN "name",
DROP COLUMN "subject",
ADD COLUMN     "eventId" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "roomNo" TEXT,
ADD COLUMN     "salutation" TEXT NOT NULL DEFAULT 'Hr.',
ADD COLUMN     "surname" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" TEXT,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
