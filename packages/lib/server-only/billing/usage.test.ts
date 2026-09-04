import type { Prisma } from '@prisma/client';
import { BillingProvider, type Subscription, SubscriptionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Phase 6 Step 6 — entitlement limit math + exactly-once usage accounting.
 *
 * The Prisma client is mocked at the model level so the enforcement logic
 * (locking, counting, inserting) can be exercised without a database. The
 * prisma module is loaded once and per-test mocks are wired through
 * `__setPrismaMock`.
 */

/**
 * Transaction-client mock shaped as `Prisma.TransactionClient` — every model
 * method the enforcement path touches is a vi.fn; the cast happens once here
 * so call sites stay honest.
 */
const mockClient = {
  $queryRaw: vi.fn(),
  subscription: {
    findUnique: vi.fn(),
  },
  billingUsageEvent: {
    count: vi.fn(),
    create: vi.fn(),
  },
} as unknown as Prisma.TransactionClient & {
  $queryRaw: ReturnType<typeof vi.fn>;
  subscription: { findUnique: ReturnType<typeof vi.fn> };
  billingUsageEvent: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};

vi.mock('@documenso/prisma', () => ({
  prisma: mockClient,
}));

const { assertAndRecordEnvelopeSend, assertOrganisationAllowsFeature, recordEnvelopeSendEvent } = await import(
  './usage'
);

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
    plan: 'PRO' as Subscription['plan'],
    periodStart: new Date('2026-09-04T00:00:00.000Z'),
    paymentFailedAt: null,
    ...overrides,
  };
};

const freeSubscription = null as unknown as Subscription;

beforeEach(() => {
  vi.clearAllMocks();

  // Organisation row lock succeeds.
  mockClient.$queryRaw.mockResolvedValue([]);
});

describe('assertAndRecordEnvelopeSend — document limit enforcement', () => {
  it('blocks the 4th send of the month on the free Starter plan', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(3);

    await expect(
      assertAndRecordEnvelopeSend(mockClient, {
        organisationId: 'org_1',
        envelopeId: 'env_4',
        recipientCount: 1,
      }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_SEND_LIMIT_REACHED' });

    // Blocked before any write happens.
    expect(mockClient.billingUsageEvent.create).not.toHaveBeenCalled();
  });

  it('allows the 3rd send and records the exactly-once journal entry', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(2);
    mockClient.billingUsageEvent.create.mockResolvedValue({});

    await assertAndRecordEnvelopeSend(mockClient, {
      organisationId: 'org_1',
      envelopeId: 'env_3',
      recipientCount: 2,
      sentAt: new Date('2026-09-10T00:00:00.000Z'),
    });

    expect(mockClient.billingUsageEvent.create).toHaveBeenCalledWith({
      data: {
        organisationId: 'org_1',
        envelopeId: 'env_3',
        sentAt: new Date('2026-09-10T00:00:00.000Z'),
      },
    });
  });

  it('counts only events inside the usage window (period-boundary counting)', async () => {
    // Free plan: the usage window is the current UTC calendar month.
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(0);
    mockClient.billingUsageEvent.create.mockResolvedValue({});

    const sentAt = new Date('2026-09-10T12:00:00.000Z');

    await assertAndRecordEnvelopeSend(mockClient, {
      organisationId: 'org_1',
      envelopeId: 'env_free_window',
      recipientCount: 1,
      sentAt,
    });

    // The count filter must use the usage window start (calendar month for
    // the free plan), not an unbounded count.
    expect(mockClient.billingUsageEvent.count).toHaveBeenCalledWith({
      where: {
        organisationId: 'org_1',
        sentAt: {
          gte: new Date('2026-09-01T00:00:00.000Z'),
        },
      },
    });
  });

  it('locks the organisation row before reading state (concurrency guard)', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(0);
    mockClient.billingUsageEvent.create.mockResolvedValue({});

    await assertAndRecordEnvelopeSend(mockClient, {
      organisationId: 'org_lock',
      envelopeId: 'env_lock',
      recipientCount: 1,
    });

    expect(mockClient.$queryRaw).toHaveBeenCalled();
  });

  it('never blocks paid plans (null quota)', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(paidSubscription());

    await assertAndRecordEnvelopeSend(mockClient, {
      organisationId: 'org_1',
      envelopeId: 'env_pro',
      recipientCount: 50,
    });

    expect(mockClient.billingUsageEvent.count).not.toHaveBeenCalled();
    expect(mockClient.billingUsageEvent.create).toHaveBeenCalledTimes(1);
  });

  it('swallows a unique-constraint race (retried send counts once)', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(0);

    const uniqueViolation = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

    mockClient.billingUsageEvent.create.mockRejectedValue(uniqueViolation);

    // The retried send must not fail the caller — the first insert already won.
    await expect(
      assertAndRecordEnvelopeSend(mockClient, {
        organisationId: 'org_1',
        envelopeId: 'env_race',
        recipientCount: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it('re-throws non-uniqueness database errors', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(0);
    mockClient.billingUsageEvent.create.mockRejectedValue(new Error('connection refused'));

    await expect(
      assertAndRecordEnvelopeSend(mockClient, {
        organisationId: 'org_1',
        envelopeId: 'env_db_error',
        recipientCount: 1,
      }),
    ).rejects.toThrow('connection refused');
  });
});

describe('assertAndRecordEnvelopeSend — recipient limit enforcement', () => {
  it('blocks a 3-recipient document on the free Starter plan', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);

    await expect(
      assertAndRecordEnvelopeSend(mockClient, {
        organisationId: 'org_1',
        envelopeId: 'env_too_many',
        recipientCount: 3,
      }),
    ).rejects.toMatchObject({ code: 'RECIPIENT_LIMIT_EXCEEDED' });

    expect(mockClient.billingUsageEvent.create).not.toHaveBeenCalled();
  });

  it('allows exactly 2 recipients on the free Starter plan', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);
    mockClient.billingUsageEvent.count.mockResolvedValue(0);
    mockClient.billingUsageEvent.create.mockResolvedValue({});

    await expect(
      assertAndRecordEnvelopeSend(mockClient, {
        organisationId: 'org_1',
        envelopeId: 'env_two',
        recipientCount: 2,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('assertOrganisationAllowsFeature', () => {
  it('rejects templates on the free Starter plan', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);

    await expect(
      assertOrganisationAllowsFeature({ organisationId: 'org_1', feature: 'templates' }),
    ).rejects.toMatchObject({ code: 'PLAN_FEATURE_REQUIRED' });
  });

  it('rejects API access on the free Starter plan', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(freeSubscription);

    await expect(assertOrganisationAllowsFeature({ organisationId: 'org_1', feature: 'api' })).rejects.toMatchObject({
      code: 'PLAN_FEATURE_REQUIRED',
    });
  });

  it('allows templates and API on Pro', async () => {
    mockClient.subscription.findUnique.mockResolvedValue(paidSubscription());

    await expect(
      assertOrganisationAllowsFeature({ organisationId: 'org_1', feature: 'templates' }),
    ).resolves.toBeUndefined();

    await expect(assertOrganisationAllowsFeature({ organisationId: 'org_1', feature: 'api' })).resolves.toBeUndefined();
  });
});

describe('recordEnvelopeSendEvent (recipient-initiated sends)', () => {
  it('records usage without enforcing any cap', async () => {
    mockClient.billingUsageEvent.create.mockResolvedValue({});

    await recordEnvelopeSendEvent(mockClient, {
      organisationId: 'org_1',
      envelopeId: 'env_direct',
    });

    expect(mockClient.billingUsageEvent.create).toHaveBeenCalledTimes(1);
    expect(mockClient.$queryRaw).not.toHaveBeenCalled();
  });
});
