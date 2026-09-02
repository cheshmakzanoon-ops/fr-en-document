-- Phase 5, Step 6 — per-recipient email locale (D-024 debt).
-- Adds Recipient.language (nullable = inherit document language).
--
-- Reversible: ALTER TABLE "Recipient" DROP COLUMN "language";

-- AlterTable
ALTER TABLE "Recipient" ADD COLUMN "language" TEXT;
