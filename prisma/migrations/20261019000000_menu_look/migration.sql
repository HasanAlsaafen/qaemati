ALTER TABLE "Restaurant" ADD COLUMN "menuLayout" TEXT NOT NULL DEFAULT 'grid',
ADD COLUMN "itemImages" TEXT NOT NULL DEFAULT 'show',
ADD COLUMN "itemImageShape" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN "categoryMarker" TEXT NOT NULL DEFAULT 'none';
