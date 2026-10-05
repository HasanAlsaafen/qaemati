-- CreateTable
CREATE TABLE "MenuView" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "itemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuView_restaurantId_createdAt_idx" ON "MenuView"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "MenuView_itemId_createdAt_idx" ON "MenuView"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "MenuView" ADD CONSTRAINT "MenuView_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuView" ADD CONSTRAINT "MenuView_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
