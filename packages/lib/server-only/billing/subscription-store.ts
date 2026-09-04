import { prisma } from '@documenso/prisma';
import type { BillingPlanType, BillingProvider, Prisma, SubscriptionStatus } from '@prisma/client';

/**
 * Database access for the NorthSign `Subscription` row (Phase 6, D-032).
 *
 * Only the billing providers (mock + stripe) and the webhook path write
 * through here. The row is keyed 1:1 to the organisation
 * (`organisationId @unique`), so every write below is a convergent upsert —
 * replaying the same provider state (webhook retries, stripe CLI triggers,
 * re-syncing) always converges to the same row (idempotency by
 * construction).
 */

export type UpsertSubscriptionOptions = {
  organisationId: string;
  provider: BillingProvider;
  plan: BillingPlanType;
  status: SubscriptionStatus;

  /**
   * Provider subscription id (Stripe subscription id; deterministic mock id
   * under the mock provider). Stored in the upstream `planId` column, which
   * carries a UNIQUE constraint.
   */
  providerSubscriptionId: string;

  /**
   * Provider price id (Stripe price id; deterministic mock price id).
   */
  priceId: string;

  /**
   * Stripe customer id (mock uses a deterministic customer id per org).
   */
  customerId: string;

  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;

  /**
   * When provided, explicitly sets/clears the payment-failed flag
   * (`invoice.payment_failed` / `invoice.paid`).
   */
  paymentFailedAt?: Date | null;
};

export const findSubscriptionByOrganisationId = (organisationId: string) => {
  return prisma.subscription.findUnique({
    where: {
      organisationId,
    },
  });
};

export const findOrganisationByStripeCustomerId = (customerId: string) => {
  return prisma.organisation.findUnique({
    where: {
      customerId,
    },
  });
};

/**
 * Convergent upsert of the organisation's subscription row keyed on
 * `organisationId`. Never deletes history — a cancelled subscription is kept
 * with status INACTIVE so the free-tier usage window can honour the last
 * paid period end (BILLING.md §2.4).
 */
export const upsertSubscription = async (options: UpsertSubscriptionOptions) => {
  const data: Prisma.SubscriptionUncheckedCreateInput = {
    provider: options.provider,
    plan: options.plan,
    status: options.status,
    planId: options.providerSubscriptionId,
    priceId: options.priceId,
    customerId: options.customerId,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    cancelAtPeriodEnd: options.cancelAtPeriodEnd,
    organisationId: options.organisationId,
  };

  if (options.paymentFailedAt !== undefined) {
    data.paymentFailedAt = options.paymentFailedAt;
  }

  return await prisma.subscription.upsert({
    where: {
      organisationId: options.organisationId,
    },
    update: data,
    create: data,
  });
};

export type UpdateSubscriptionFlagsOptions = {
  organisationId: string;
  status?: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  paymentFailedAt?: Date | null;
  periodEnd?: Date;
};

/**
 * Partial, convergent updates used by webhook events that only touch a
 * subset of the row (payment-failed banner flag, cancel-at-period-end).
 */
export const updateSubscriptionFlags = async (options: UpdateSubscriptionFlagsOptions) => {
  const data: Prisma.SubscriptionUncheckedUpdateInput = {};

  if (options.status !== undefined) {
    data.status = options.status;
  }

  if (options.cancelAtPeriodEnd !== undefined) {
    data.cancelAtPeriodEnd = options.cancelAtPeriodEnd;
  }

  if (options.paymentFailedAt !== undefined) {
    data.paymentFailedAt = options.paymentFailedAt;
  }

  if (options.periodEnd !== undefined) {
    data.periodEnd = options.periodEnd;
  }

  if (Object.keys(data).length === 0) {
    return null;
  }

  return await prisma.subscription.update({
    where: {
      organisationId: options.organisationId,
    },
    data,
  });
};

/**
 * Deterministic mock identifiers so mock mode stays fully offline.
 */
export const MOCK_PRICE_PREFIX = 'mock_price';

export const mockPriceId = (plan: BillingPlanType, interval: 'monthly' | 'annual'): string => {
  return `${MOCK_PRICE_PREFIX}_${plan.toLowerCase()}_${interval}`;
};

export const mockSubscriptionId = (organisationId: string): string => {
  return `mock_sub_${organisationId}`;
};

export const mockCustomerId = (organisationId: string): string => {
  return `mock_cus_${organisationId}`;
};
