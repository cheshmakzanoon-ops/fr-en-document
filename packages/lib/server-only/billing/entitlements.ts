import { BillingPlanType, type Subscription, SubscriptionStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { BILLING_PLANS, type NorthSignPlanDefinition } from './plans';

/**
 * Pure entitlement resolution and usage-window math (Phase 6, D-032).
 *
 * The free Starter plan is the absence of a managed subscription row: no row
 * (or a row that is not an ACTIVE/PAST_DUE paid row) resolves to STARTER.
 * Nothing here touches the database — unit tests exercise every branch.
 */

const PAID_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
]);

/**
 * Whether the row represents a live paid NorthSign subscription managed by
 * either billing provider. Rows written by other (upstream/EE) machinery
 * have `provider`/`plan` null and therefore never count as paid here.
 */
export const isPaidSubscription = (
  subscription: Subscription | null,
): subscription is Subscription & { plan: BillingPlanType } => {
  if (!subscription) {
    return false;
  }

  return (
    subscription.provider !== null && subscription.plan !== null && PAID_SUBSCRIPTION_STATUSES.has(subscription.status)
  );
};

/**
 * Resolve the effective plan for an organisation. Missing/inactive rows are
 * the free Starter plan.
 */
export const resolvePlanForSubscription = (subscription: Subscription | null): BillingPlanType => {
  return isPaidSubscription(subscription) ? subscription.plan : BillingPlanType.STARTER;
};

const startOfUtcMonth = (date: Date): Date => {
  return DateTime.fromJSDate(date).toUTC().startOf('month').toJSDate();
};

/**
 * Start of the usage window a send is counted against (BILLING.md §2.4):
 * - Paid plan: the subscription's own `periodStart`.
 * - Free plan: the later of the start of the current UTC calendar month and
 *   the end of the last paid period (so a period-end downgrade never
 *   instantly locks a sender who already used the free allowance mid-month).
 */
export const getUsageWindowStart = (subscription: Subscription | null, now: Date = new Date()): Date => {
  if (isPaidSubscription(subscription) && subscription.periodStart) {
    return subscription.periodStart;
  }

  const monthStart = startOfUtcMonth(now);

  const lastPaidPeriodEnd = subscription?.periodEnd;

  if (lastPaidPeriodEnd && lastPaidPeriodEnd.getTime() > monthStart.getTime()) {
    return lastPaidPeriodEnd;
  }

  return monthStart;
};

export type BillingEntitlement = NorthSignPlanDefinition & {
  plan: BillingPlanType;

  /**
   * Start of the current usage window (used for counting + display).
   */
  periodStart: Date;

  /**
   * End of the paid billing period; null on the open-ended free window.
   */
  periodEnd: Date | null;

  /**
   * Whether the underlying subscription is paid (vs free Starter).
   */
  isPaid: boolean;
};

/**
 * Effective entitlement for an organisation given its (nullable) subscription
 * row and the current instant.
 */
export const getEntitlement = (subscription: Subscription | null, now: Date = new Date()): BillingEntitlement => {
  const plan = resolvePlanForSubscription(subscription);

  return {
    ...BILLING_PLANS[plan],
    plan,
    periodStart: getUsageWindowStart(subscription, now),
    periodEnd: subscription?.periodEnd ?? null,
    isPaid: isPaidSubscription(subscription),
  };
};

/**
 * Pure math for the free-tier send allowance. Shared by the enforcement path
 * and the UI banners so the "at / near limit" thresholds cannot drift.
 */
export const getDocumentsRemaining = (entitlement: BillingEntitlement, sentThisPeriod: number): number | null => {
  if (entitlement.documentsPerPeriod === null) {
    return null;
  }

  return Math.max(entitlement.documentsPerPeriod - sentThisPeriod, 0);
};

/**
 * True when a finite quota has been fully used (further sends are blocked).
 */
export const hasReachedDocumentLimit = (entitlement: BillingEntitlement, sentThisPeriod: number): boolean => {
  if (entitlement.documentsPerPeriod === null) {
    return false;
  }

  return sentThisPeriod >= entitlement.documentsPerPeriod;
};

/**
 * True when a finite quota is within one send of the cap (banner trigger).
 */
export const isNearingDocumentLimit = (entitlement: BillingEntitlement, sentThisPeriod: number): boolean => {
  if (entitlement.documentsPerPeriod === null) {
    return false;
  }

  return sentThisPeriod >= entitlement.documentsPerPeriod - 1;
};
