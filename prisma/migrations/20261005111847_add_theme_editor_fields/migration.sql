-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "backgroundColor" TEXT,
ADD COLUMN     "cardStyle" TEXT NOT NULL DEFAULT 'flat',
ADD COLUMN     "buttonShape" TEXT NOT NULL DEFAULT 'rounded';
