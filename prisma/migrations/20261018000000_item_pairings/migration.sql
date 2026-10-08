-- CreateTable
CREATE TABLE "ItemPairing" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pairedItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionAdd" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionAdd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemPairing_restaurantId_idx" ON "ItemPairing"("restaurantId");
CREATE UNIQUE INDEX "ItemPairing_itemId_pairedItemId_key" ON "ItemPairing"("itemId", "pairedItemId");
CREATE INDEX "SuggestionAdd_restaurantId_createdAt_idx" ON "SuggestionAdd"("restaurantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ItemPairing" ADD CONSTRAINT "ItemPairing_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemPairing" ADD CONSTRAINT "ItemPairing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemPairing" ADD CONSTRAINT "ItemPairing_pairedItemId_fkey" FOREIGN KEY ("pairedItemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuggestionAdd" ADD CONSTRAINT "SuggestionAdd_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SuggestionAdd" ADD CONSTRAINT "SuggestionAdd_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
