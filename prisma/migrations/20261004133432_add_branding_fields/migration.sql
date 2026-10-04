-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "coverImagePath" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'ILS',
ADD COLUMN     "primaryColor" TEXT;


