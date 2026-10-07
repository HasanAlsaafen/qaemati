-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'CASHIER', 'KITCHEN');

-- AlterTable: every account that exists today is an owner
ALTER TABLE "AdminUser" ADD COLUMN "role" "StaffRole" NOT NULL DEFAULT 'OWNER';
