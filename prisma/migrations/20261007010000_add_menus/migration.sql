-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "menuId" TEXT;

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "availableFrom" TEXT,
    "availableTo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Menu_restaurantId_idx" ON "Menu"("restaurantId");

-- CreateIndex
CREATE INDEX "Category_menuId_idx" ON "Category"("menuId");

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing restaurant gets one named menu holding all of
-- its current categories, so nothing changes on the public page.
INSERT INTO "Menu" ("id", "restaurantId", "nameAr", "nameEn", "sortOrder", "updatedAt")
SELECT 'menu_' || substr(md5(r."id" || 'main'), 1, 20), r."id", 'القائمة الرئيسية', 'Main menu', 0, CURRENT_TIMESTAMP
FROM "Restaurant" r;

UPDATE "Category" c
SET "menuId" = m."id"
FROM "Menu" m
WHERE m."restaurantId" = c."restaurantId";
