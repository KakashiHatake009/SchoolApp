-- AlterTable: add teacher presence flags to Slot
ALTER TABLE "Slot" ADD COLUMN "teacher1Present" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Slot" ADD COLUMN "teacher2Present" BOOLEAN NOT NULL DEFAULT true;
