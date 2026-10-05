-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "categoryDivider" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "backgroundStyle" TEXT NOT NULL DEFAULT 'solid',
ADD COLUMN     "backgroundPattern" TEXT NOT NULL DEFAULT 'dots',
ADD COLUMN     "backgroundImagePath" TEXT;
