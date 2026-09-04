import { BillingPlanType, BillingProvider, type Subscription, SubscriptionStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  getDocumentsRemaining,
  getEntitlement,
  getUsageWindowStart,
  hasReachedDocumentLimit,
  isNearingDocumentLimit,
  isPaidSubscription,
  resolvePlanForSubscription,
} from './entitlements';

/**
 * Phase 6 Step 6 — pure entitlement math (BILLING.md §2/§5). No database:
 * subscription rows are constructed fixtures.
 */

const NOW = new Date('2026-09-04T12:00:00.000Z');

const paidSubscription = (overrides: Partial<Subscription> = {}): Subscription => {
  return {
    id: 1,
    status: SubscriptionStatus.ACTIVE,
    planId: 'sub_test_123',
    priceId: 'price_test_pro_monthly',
    periodEnd: new Date('2026-10-04T00:00:00.000Z'),
    createdAt: new Date('2026-09-04T00:00:00.000Z'),
    updatedAt: new Date('2026-09-04T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    customerId: 'cus_test_123',
    organisationId: 'org_1',
    provider: BillingProvider.STRIPE,
    plan: BillingPlanType.PRO,
    periodStart: new Date('2026-09-04T00:00:00.000Z'),
    paymentFailedAt: null,
    ...overrides,
  };
};

describe('isPaidSubscription', () => {
  it('rejects a missing row (free Starter is the absence of a subscription)', () => {
    expect(isPaidSubscription(null)).toBe(false);
  });

  it('rejects rows managed by other machinery (provider/plan null)', () => {
    const legacy = paidSubscription({ provider: null, plan: null });

    expect(isPaidSubscription(legacy)).toBe(false);
  });

  it('accepts active paid rows', () => {
    expect(isPaidSubscription(paidSubscription())).toBe(true);
  });

  it('treats PAST_DUE as still-paid (grace until period end)', () => {
    expect(isPaidSubscription(paidSubscription({ status: SubscriptionStatus.PAST_DUE }))).toBe(true);
  });

  it('rejects INACTIVE rows (period ended / cancelled)', () => {
    expect(isPaidSubscription(paidSubscription({ status: SubscriptionStatus.INACTIVE }))).toBe(false);
  });
});

describe('resolvePlanForSubscription', () => {
  it('falls back to STARTER for null rows', () => {
    expect(resolvePlanForSubscription(null)).toBe(BillingPlanType.STARTER);
  });

  it('falls back to STARTER when the paid row has expired', () => {
    expect(resolvePlanForSubscription(paidSubscription({ status: SubscriptionStatus.INACTIVE }))).toBe(
      BillingPlanType.STARTER,
    );
  });

  it('resolves the paid plan for an active subscription', () => {
    expect(resolvePlanForSubscription(paidSubscription({ plan: BillingPlanType.BUSINESS }))).toBe(
      BillingPlanType.BUSINESS,
    );
  });
});

describe('getUsageWindowStart', () => {
  it('uses the subscription period start for paid plans', () => {
    const window = getUsageWindowStart(paidSubscription(), NOW);

    expect(window.toISOString()).toBe('2026-09-04T00:00:00.000Z');
  });

  it('uses the start of the current UTC month on the free plan (no row)', () => {
    const window = getUsageWindowStart(null, NOW);

    expect(window.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('free window honours the last paid period end after a mid-month downgrade (period boundary)', () => {
    // Paid period ran Sep 4 → Oct 4; the downgrade happened Oct 10. The free
    // window must not count sends made before Oct 4 against the new month.
    const expired = paidSubscription({
      status: SubscriptionStatus.INACTIVE,
      periodStart: new Date('2026-09-04T00:00:00.000Z'),
      periodEnd: new Date('2026-10-04T00:00:00.000Z'),
    });

    const afterDowngrade = new Date('2026-10-10T08:00:00.000Z');
    const window = getUsageWindowStart(expired, afterDowngrade);

    expect(window.toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });

  it('clamps the free window to the current month once the old period end is in the past', () => {
    const expired = paidSubscription({
      status: SubscriptionStatus.INACTIVE,
      periodEnd: new Date('2026-08-04T00:00:00.000Z'),
    });

    const window = getUsageWindowStart(expired, NOW);

    expect(window.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('getEntitlement — plan limits', () => {
  it('Starter: 3 documents, 2 recipients, no templates, no API', () => {
    const entitlement = getEntitlement(null, NOW);

    expect(entitlement.plan).toBe(BillingPlanType.STARTER);
    expect(entitlement.documentsPerPeriod).toBe(3);
    expect(entitlement.recipientsPerDocument).toBe(2);
    expect(entitlement.allowsTemplates).toBe(false);
    expect(entitlement.allowsApi).toBe(false);
    expect(entitlement.allowsTeams).toBe(false);
    expect(entitlement.isPaid).toBe(false);
  });

  it('Pro: unlimited documents/recipients, templates + API', () => {
    const entitlement = getEntitlement(paidSubscription(), NOW);

    expect(entitlement.plan).toBe(BillingPlanType.PRO);
    expect(entitlement.documentsPerPeriod).toBeNull();
    expect(entitlement.recipientsPerDocument).toBeNull();
    expect(entitlement.allowsTemplates).toBe(true);
    expect(entitlement.allowsApi).toBe(true);
    expect(entitlement.isPaid).toBe(true);
  });

  it('Business sells team features (enforced in Phase 8)', () => {
    const entitlement = getEntitlement(paidSubscription({ plan: BillingPlanType.BUSINESS }), NOW);

    expect(entitlement.allowsTeams).toBe(true);
  });
});

describe('getDocumentsRemaining / hasReachedDocumentLimit / isNearingDocumentLimit', () => {
  const starter = getEntitlement(null, NOW);

  it('null limit is unlimited (remaining null, never reached)', () => {
    const pro = getEntitlement(paidSubscription(), NOW);

    expect(getDocumentsRemaining(pro, 999_999)).toBeNull();
    expect(hasReachedDocumentLimit(pro, 999_999)).toBe(false);
    expect(isNearingDocumentLimit(pro, 999_999)).toBe(false);
  });

  it('remaining counts down and floors at zero', () => {
    expect(getDocumentsRemaining(starter, 0)).toBe(3);
    expect(getDocumentsRemaining(starter, 2)).toBe(1);
    expect(getDocumentsRemaining(starter, 3)).toBe(0);
    expect(getDocumentsRemaining(starter, 10)).toBe(0);
  });

  it('reached boundary is exactly at the cap (>=)', () => {
    expect(hasReachedDocumentLimit(starter, 2)).toBe(false);
    expect(hasReachedDocumentLimit(starter, 3)).toBe(true);
    expect(hasReachedDocumentLimit(starter, 4)).toBe(true);
  });

  it('nearing triggers within one send of the cap (banner threshold)', () => {
    expect(isNearingDocumentLimit(starter, 1)).toBe(false);
    expect(isNearingDocumentLimit(starter, 2)).toBe(true);
    expect(isNearingDocumentLimit(starter, 3)).toBe(true);
  });
});
