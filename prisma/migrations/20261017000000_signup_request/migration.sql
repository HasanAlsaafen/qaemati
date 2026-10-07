-- CreateTable
CREATE TABLE "SignupRequest" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupRequest_tokenHash_key" ON "SignupRequest"("tokenHash");
CREATE INDEX "SignupRequest_email_idx" ON "SignupRequest"("email");
CREATE INDEX "SignupRequest_slug_idx" ON "SignupRequest"("slug");
CREATE INDEX "SignupRequest_expiresAt_idx" ON "SignupRequest"("expiresAt");

-- AddForeignKey
ALTER TABLE "SignupRequest" ADD CONSTRAINT "SignupRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
