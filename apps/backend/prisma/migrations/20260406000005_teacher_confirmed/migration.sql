-- Track whether each teacher in a pair has published their slot availability
ALTER TABLE "Teacher" ADD COLUMN "teacher1Confirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Teacher" ADD COLUMN "teacher2Confirmed" BOOLEAN NOT NULL DEFAULT false;
