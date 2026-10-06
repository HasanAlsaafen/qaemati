-- CreateTable
CREATE TABLE "BulkOperationLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "BulkOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkOperationLog_restaurantId_createdAt_idx" ON "BulkOperationLog"("restaurantId", "createdAt");

-- AddForeignKey
ALTER TABLE "BulkOperationLog" ADD CONSTRAINT "BulkOperationLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
