-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "availableFrom" TEXT,
ADD COLUMN     "availableTo" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "isTodaysSpecial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "closeTime" TEXT,
ADD COLUMN     "openTime" TEXT;


