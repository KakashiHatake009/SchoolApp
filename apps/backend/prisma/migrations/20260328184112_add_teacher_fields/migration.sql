-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "bookingStatus" TEXT NOT NULL DEFAULT 'not_booked',
ADD COLUMN     "email2" TEXT,
ADD COLUMN     "firstName2" TEXT,
ADD COLUMN     "klasse" TEXT,
ADD COLUMN     "salutation2" TEXT,
ADD COLUMN     "surname2" TEXT,
ADD COLUMN     "titel" TEXT,
ADD COLUMN     "titel2" TEXT;
