-- Make teacher presence fields nullable: null = not responded, false = absent, true = present
ALTER TABLE "Slot" ALTER COLUMN "teacher1Present" DROP DEFAULT;
ALTER TABLE "Slot" ALTER COLUMN "teacher1Present" DROP NOT NULL;
ALTER TABLE "Slot" ALTER COLUMN "teacher2Present" DROP DEFAULT;
ALTER TABLE "Slot" ALTER COLUMN "teacher2Present" DROP NOT NULL;

-- Reset all existing slots to "not responded"
UPDATE "Slot" SET "teacher1Present" = NULL, "teacher2Present" = NULL;
