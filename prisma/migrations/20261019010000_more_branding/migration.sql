ALTER TABLE "Restaurant" ADD COLUMN "logoShape" TEXT NOT NULL DEFAULT 'rounded',
ADD COLUMN "coverHeight" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "priceStyle" TEXT NOT NULL DEFAULT 'plain',
ADD COLUMN "headingAlign" TEXT NOT NULL DEFAULT 'start';
