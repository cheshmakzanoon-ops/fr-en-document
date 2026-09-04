-- NorthSign billing (Phase 6) — ROLLBACK of migration.sql.
-- Reverts the schema to its pre-Phase-6 state. Operator procedure when a
-- rollback is ever required (see BILLING.md §3.2):
--   1. psql "$NEXT_PRIVATE_DIRECT_DATABASE_URL" -f packages/prisma/migrations/20260904000000_northsign_billing/down.sql
--   2. npx prisma migrate resolve --rolled-back 20260904000000_northsign_billing
-- Warning: destroys the BillingUsageEvent send journal and the Phase 6
-- subscription columns. Only run when rolling the feature back.

-- DropForeignKey
ALTER TABLE "BillingUsageEvent" DROP CONSTRAINT "BillingUsageEvent_organisationId_fkey";

-- DropTable
DROP TABLE "BillingUsageEvent";

-- AlterTable
ALTER TABLE "Subscription"
DROP COLUMN "paymentFailedAt",
DROP COLUMN "periodStart",
DROP COLUMN "plan",
DROP COLUMN "provider";

-- DropEnum
DROP TYPE "BillingPlanType";

-- DropEnum
DROP TYPE "BillingProvider";
