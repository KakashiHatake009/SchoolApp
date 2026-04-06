-- Add separate access code for the second teacher in a pair
ALTER TABLE "Teacher" ADD COLUMN "accessCode2" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "accessCode2Expires" TIMESTAMP(3);
