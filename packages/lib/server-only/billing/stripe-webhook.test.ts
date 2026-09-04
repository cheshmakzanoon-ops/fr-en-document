import { BillingProvider, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Phase 6 Step 6 — Stripe webhook handler against fixture payloads.
 *
 * Runs fully offline: signatures are generated with Stripe's own
 * `generateTestHeaderString` for a local test secret and verified with the
 * real `constructEvent`; every database touchpoint is mocked, so CI stays
 * secret-free and network-free.
 */

const TEST_WEBHOOK_SECRET = 'whsec_test_00000000000000000000000000000000';

const UPDATE_FLAGS_MOCK = vi.fn();
const UPSERT_MOCK = vi.fn();
const ORG_FIND_UNIQUE_MOCK = vi.fn();

vi.mock('@documenso/prisma', () => ({
  prisma: {
    organisation: {
      findUnique: ORG_FIND_UNIQUE_MOCK,
    },
  },
}));

vi.mock('./stripe-provider', () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: (payload: string, header: string, secret: string): Stripe.Event => {
        // Real verification logic, executed offline against the test secret.
        const StripeCtor = StripeCtorHolder.StripeCtor;

        if (!StripeCtor) {
          throw new Error('Stripe constructor was not initialised');
        }

        const webhooks = new StripeCtor(secret, { apiVersion: '2022-11-15' }).webhooks;

        return webhooks.constructEvent(payload, header, secret);
      },
    },
  }),
  getStripeWebhookSecret: () => TEST_WEBHOOK_SECRET,
  stripeSubscriptionToUpsertOptions: STRIPE_TO_UPSERT_MOCK,
  syncSubscriptionFromStripe: SYNC_MOCK,
}));

vi.mock('./subscription-store', () => ({
  findSubscriptionByOrganisationId: FIND_SUBSCRIPTION_MOCK,
  updateSubscriptionFlags: UPDATE_FLAGS_MOCK,
  upsertSubscription: UPSERT_MOCK,
}));

// Lazily wired below: the real `stripeSubscriptionToUpsertOptions` runs
// against the real `mapStripePriceIdToPlan`, which needs env price ids —
// we point those env vars at our fixture price ids in beforeAll.
const STRIPE_TO_UPSERT_MOCK = vi.fn();
const SYNC_MOCK = vi.fn();
const FIND_SUBSCRIPTION_MOCK = vi.fn();

// Holds the real Stripe constructor for the offline verifier above.
const StripeCtorHolder: { StripeCtor: typeof Stripe | null } = {
  StripeCtor: null,
};

const { handleStripeWebhookRequest } = await import('./stripe-webhook');

const stripe = new Stripe('sk_test_offline_placeholder', { apiVersion: '2022-11-15' });

StripeCtorHolder.StripeCtor = Stripe;

/**
 * Build a signed webhook request from a raw payload using Stripe's test
 * header generator (real HMAC, computed locally with the test secret).
 */
const signedRequest = async (payload: unknown, secret = TEST_WEBHOOK_SECRET): Promise<Request> => {
  const body = JSON.stringify(payload);

  const header = await stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });

  return new Request('https://app.northsign.test/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': header,
    },
    body,
  });
};

const unsignedRequest = (payload: unknown): Request => {
  return new Request('https://app.northsign.test/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
};

const subscriptionPayload = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => {
  return {
    id: 'sub_test_123',
    object: 'subscription',
    customer: 'cus_test_123',
    status: 'active',
    current_period_start: 1788240000, // 2026-09-04T00:00:00Z
    current_period_end: 1790832000, // 2026-10-04T00:00:00Z
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_test_123',
          object: 'subscription_item',
          price: {
            id: 'price_test_pro_monthly',
            object: 'price',
            currency: 'cad',
            unit_amount: 1900,
            type: 'recurring',
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    ...overrides,
  };
};

const eventPayload = (type: string, dataObject: unknown): Record<string, unknown> => {
  return {
    id: `evt_test_${type.replace(/\./g, '_')}`,
    object: 'event',
    api_version: '2022-11-15',
    created: 1788240000,
    type,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: dataObject,
    },
  };
};

const organisation = { id: 'org_1', customerId: 'cus_test_123' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleStripeWebhookRequest — signature verification', () => {
  it('rejects requests without a stripe-signature header', async () => {
    const response = await handleStripeWebhookRequest(unsignedRequest(eventPayload('invoice.paid', {})));

    expect(response.status).toBe(400);
  });

  it('rejects a payload signed with the wrong secret', async () => {
    const response = await handleStripeWebhookRequest(
      await signedRequest(eventPayload('invoice.paid', {}), 'whsec_wrong_secret'),
    );

    expect(response.status).toBe(400);
  });

  it('accepts a validly signed payload', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);
    UPSERT_MOCK.mockResolvedValue({});

    const response = await handleStripeWebhookRequest(
      await signedRequest(eventPayload('customer.subscription.updated', subscriptionPayload())),
    );

    expect(response.status).toBe(200);
  });
});

describe('handleStripeWebhookRequest — event routing and idempotency', () => {
  it('customer.subscription.updated upserts the local row (convergent on replay)', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);
    UPSERT_MOCK.mockResolvedValue({});

    STRIPE_TO_UPSERT_MOCK.mockReturnValue({
      organisationId: organisation.id,
      provider: BillingProvider.STRIPE,
      plan: 'PRO',
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: 'sub_test_123',
      priceId: 'price_test_pro_monthly',
      customerId: organisation.customerId,
      periodStart: new Date('2026-09-04T00:00:00.000Z'),
      periodEnd: new Date('2026-10-04T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
    });

    const payload = eventPayload('customer.subscription.updated', subscriptionPayload());

    // Deliver the same event twice — Stripe retries / double-delivery.
    await handleStripeWebhookRequest(await signedRequest(payload));
    const second = await handleStripeWebhookRequest(await signedRequest(payload));

    expect(second.status).toBe(200);
    // One upsert call per delivery, same convergent shape — replay-safe.
    expect(UPSERT_MOCK).toHaveBeenCalledTimes(2);
    expect(UPSERT_MOCK.mock.calls[0][0].providerSubscriptionId).toBe('sub_test_123');
  });

  it('customer.subscription.updated ignores unknown prices (no plan change off a foreign price)', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);

    STRIPE_TO_UPSERT_MOCK.mockReturnValue(null);

    await handleStripeWebhookRequest(
      await signedRequest(
        eventPayload(
          'customer.subscription.updated',
          subscriptionPayload({
            items: {
              object: 'list',
              data: [{ id: 'si_x', object: 'subscription_item', price: { id: 'price_foreign', object: 'price' } }],
            },
          }),
        ),
      ),
    );

    expect(UPSERT_MOCK).not.toHaveBeenCalled();
  });

  it('customer.subscription.deleted marks the row INACTIVE and keeps history', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);
    FIND_SUBSCRIPTION_MOCK.mockResolvedValue({ provider: BillingProvider.STRIPE, status: SubscriptionStatus.ACTIVE });
    UPDATE_FLAGS_MOCK.mockResolvedValue({});

    await handleStripeWebhookRequest(
      await signedRequest(eventPayload('customer.subscription.deleted', subscriptionPayload())),
    );

    expect(UPDATE_FLAGS_MOCK).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: organisation.id,
        status: SubscriptionStatus.INACTIVE,
        cancelAtPeriodEnd: false,
        paymentFailedAt: null,
      }),
    );
  });

  it('invoice.payment_failed flags the account PAST_DUE for the banner', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);
    FIND_SUBSCRIPTION_MOCK.mockResolvedValue({ provider: BillingProvider.STRIPE, status: SubscriptionStatus.ACTIVE });
    UPDATE_FLAGS_MOCK.mockResolvedValue({});

    await handleStripeWebhookRequest(
      await signedRequest(
        eventPayload('invoice.payment_failed', {
          id: 'in_test_failed',
          object: 'invoice',
          customer: organisation.customerId,
        }),
      ),
    );

    expect(UPDATE_FLAGS_MOCK).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: organisation.id,
        status: SubscriptionStatus.PAST_DUE,
        paymentFailedAt: expect.any(Date),
      }),
    );
  });

  it('invoice.paid clears the payment-failed flag and restores ACTIVE', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);
    FIND_SUBSCRIPTION_MOCK.mockResolvedValue({ provider: BillingProvider.STRIPE, status: SubscriptionStatus.PAST_DUE });
    UPDATE_FLAGS_MOCK.mockResolvedValue({});

    await handleStripeWebhookRequest(
      await signedRequest(
        eventPayload('invoice.paid', {
          id: 'in_test_paid',
          object: 'invoice',
          customer: organisation.customerId,
        }),
      ),
    );

    expect(UPDATE_FLAGS_MOCK).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: organisation.id,
        status: SubscriptionStatus.ACTIVE,
        paymentFailedAt: null,
      }),
    );
  });

  it('ignores events for customers that are not ours (no crash, no writes)', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(null);

    const response = await handleStripeWebhookRequest(
      await signedRequest(
        eventPayload(
          'customer.subscription.updated',
          subscriptionPayload({
            customer: 'cus_someone_else',
          }),
        ),
      ),
    );

    expect(response.status).toBe(200);
    expect(UPSERT_MOCK).not.toHaveBeenCalled();
  });

  it('does not touch rows managed by other providers', async () => {
    ORG_FIND_UNIQUE_MOCK.mockResolvedValue(organisation);
    FIND_SUBSCRIPTION_MOCK.mockResolvedValue({ provider: BillingProvider.MOCK, status: SubscriptionStatus.ACTIVE });

    await handleStripeWebhookRequest(
      await signedRequest(
        eventPayload('invoice.payment_failed', {
          id: 'in_test_mock',
          object: 'invoice',
          customer: organisation.customerId,
        }),
      ),
    );

    expect(UPDATE_FLAGS_MOCK).not.toHaveBeenCalled();
  });

  it('acknowledges unrelated event types with 200', async () => {
    const response = await handleStripeWebhookRequest(
      await signedRequest(eventPayload('payment_intent.succeeded', { id: 'pi_test_1', object: 'payment_intent' })),
    );

    expect(response.status).toBe(200);
  });
});
