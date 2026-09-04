-- NorthSign billing (Phase 6, DECISIONS.md D-032 / BILLING.md §3.2).
-- Reversible via down.sql in this directory (see BILLING.md §3.2).

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('MOCK', 'STRIPE');

-- CreateEnum
CREATE TYPE "BillingPlanType" AS ENUM ('STARTER', 'PRO', 'BUSINESS');

-- AlterTable
ALTER TABLE "Subscription"
ADD COLUMN "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN "periodStart" TIMESTAMP(3),
ADD COLUMN "plan" "BillingPlanType",
ADD COLUMN "provider" "BillingProvider";

-- CreateTable
CREATE TABLE "BillingUsageEvent" (
    "id" SERIAL NOT NULL,
    "organisationId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingUsageEvent_envelopeId_key" ON "BillingUsageEvent"("envelopeId");

-- CreateIndex
CREATE INDEX "BillingUsageEvent_organisationId_sentAt_idx" ON "BillingUsageEvent"("organisationId", "sentAt");

-- AddForeignKey
ALTER TABLE "BillingUsageEvent" ADD CONSTRAINT "BillingUsageEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
