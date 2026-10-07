-- AlterTable
ALTER TABLE "SuperAdmin" ADD COLUMN "totpSecretEnc" TEXT,
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpLastStep" INTEGER,
ADD COLUMN "recoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PasswordResetToken" ALTER COLUMN "adminUserId" DROP NOT NULL,
ADD COLUMN "superAdminId" TEXT;

-- CreateIndex
CREATE INDEX "PasswordResetToken_superAdminId_idx" ON "PasswordResetToken"("superAdminId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A token belongs to exactly one kind of account.
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_one_owner" CHECK (("adminUserId" IS NULL) <> ("superAdminId" IS NULL));
