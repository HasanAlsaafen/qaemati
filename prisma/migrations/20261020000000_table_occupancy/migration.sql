CREATE TYPE "WaiterCallKind" AS ENUM ('CALL', 'BILL');

ALTER TABLE "RestaurantTable" ADD COLUMN "occupiedAt" TIMESTAMP(3),
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "billRequestedAt" TIMESTAMP(3);

ALTER TABLE "WaiterCall" ADD COLUMN "kind" "WaiterCallKind" NOT NULL DEFAULT 'CALL';
