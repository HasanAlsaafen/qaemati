-- AlterTable
ALTER TABLE "Order" ADD COLUMN "publicToken" TEXT;
UPDATE "Order" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
