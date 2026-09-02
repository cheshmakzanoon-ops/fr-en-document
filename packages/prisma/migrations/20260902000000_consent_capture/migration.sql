-- Phase 5, Step 3 — consent capture (PIPEDA cl. 4.3 / Quebec Law 25 s. 8.1).
-- Adds a UserConsentRecord table storing versioned, timestamped acceptance of
-- the Terms of Service + Privacy Policy and CASL marketing-email express
-- consent (unchecked by default at signup; see signup form).
--
-- Reversible: DROP TABLE "UserConsentRecord" and DROP TYPE "ConsentRecordType".

-- CreateEnum
CREATE TYPE "ConsentRecordType" AS ENUM ('TERMS_AND_PRIVACY', 'MARKETING_EMAIL');

-- CreateTable
CREATE TABLE "UserConsentRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "ConsentRecordType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "UserConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserConsentRecord_userId_idx" ON "UserConsentRecord"("userId");

-- CreateIndex
CREATE INDEX "UserConsentRecord_type_acceptedAt_idx" ON "UserConsentRecord"("type", "acceptedAt");

-- AddForeignKey
ALTER TABLE "UserConsentRecord" ADD CONSTRAINT "UserConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
