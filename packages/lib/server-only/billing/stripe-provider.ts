import { prisma } from '@documenso/prisma';
import { BillingPlanType, BillingProvider, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { env } from '../../utils/env';
import type {
  BillingService,
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreatePortalSessionOptions,
  CreatePortalSessionResult,
} from './billing-service';
import type { BillingInterval } from './plans';
import { findSubscriptionByOrganisationId, updateSubscriptionFlags, upsertSubscription } from './subscription-store';

/**
 * Stripe billing provider (Phase 6, D-033) — TEST MODE only.
 *
 * All keys come from the environment and are never committed:
 *   NEXT_PRIVATE_STRIPE_API_KEY            sk_test_…
 *   NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET     whsec_…   (used by the webhook
 *                                                    handler in stripe-webhook.ts)
 *   NEXT_PRIVATE_STRIPE_PRICE_{PRO,BUSINESS}_{MONTHLY,ANNUAL}
 *
 * The Stripe client is constructed lazily so importing this module in mock
 * mode never requires a key and never touches the network.
 */
export const STRIPE_PRICE_ENV_KEYS: Record<BillingPlanType, Record<BillingInterval, string>> = {
  [BillingPlanType.STARTER]: {
    monthly: '',
    annual: '',
  },
  [BillingPlanType.PRO]: {
    monthly: 'NEXT_PRIVATE_STRIPE_PRICE_PRO_MONTHLY',
    annual: 'NEXT_PRIVATE_STRIPE_PRICE_PRO_ANNUAL',
  },
  [BillingPlanType.BUSINESS]: {
    monthly: 'NEXT_PRIVATE_STRIPE_PRICE_BUSINESS_MONTHLY',
    annual: 'NEXT_PRIVATE_STRIPE_PRICE_BUSINESS_ANNUAL',
  },
};

export const getStripeApiKey = (): string => {
  const key = env('NEXT_PRIVATE_STRIPE_API_KEY');

  if (!key) {
    throw new AppError(AppErrorCode.MISSING_ENV_VAR, {
      message: 'Required environment variable "NEXT_PRIVATE_STRIPE_API_KEY" is unset. Billing provider is "stripe".',
    });
  }

  return key;
};

export const getStripeWebhookSecret = (): string => {
  const secret = env('NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET');

  if (!secret) {
    throw new AppError(AppErrorCode.MISSING_ENV_VAR, {
      message: 'Required environment variable "NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET" is unset.',
    });
  }

  return secret;
};

let cachedStripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!cachedStripeClient) {
    cachedStripeClient = new Stripe(getStripeApiKey(), {
      apiVersion: '2022-11-15',
      typescript: true,
    });
  }

  return cachedStripeClient;
};

export const getStripePriceId = (plan: BillingPlanType, interval: BillingInterval): string => {
  const envKey = STRIPE_PRICE_ENV_KEYS[plan][interval];

  if (!envKey) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: `The ${plan} plan has no Stripe price configured (interval: ${interval}).`,
    });
  }

  const priceId = env(envKey);

  if (!priceId) {
    throw new AppError(AppErrorCode.NOT_SETUP, {
      message: `Required environment variable "${envKey}" is unset for the Stripe billing provider.`,
    });
  }

  return priceId;
};

/**
 * Reverse mapping price id → plan, used by the webhook handler. Returns null
 * for prices that are not ours (never upgrades a plan off an unknown price).
 */
export const mapStripePriceIdToPlan = (priceId: string): BillingPlanType | null => {
  for (const plan of [BillingPlanType.PRO, BillingPlanType.BUSINESS]) {
    for (const interval of ['monthly', 'annual'] as const) {
      if (getStripePriceId(plan, interval) === priceId) {
        return plan;
      }
    }
  }

  return null;
};

/**
 * Create (or reuse) the Stripe customer for the organisation and persist the
 * customer id on the organisation row. The owner user is the billing contact.
 */
export const getOrCreateStripeCustomer = async (organisationId: string): Promise<string> => {
  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Organisation ${organisationId} not found`,
    });
  }

  if (organisation.customerId) {
    return organisation.customerId;
  }

  const stripe = getStripeClient();

  const customer = await stripe.customers.create({
    name: organisation.owner.name || organisation.name,
    email: organisation.owner.email,
    metadata: {
      organisationId,
    },
  });

  await prisma.organisation.update({
    where: {
      id: organisationId,
    },
    data: {
      customerId: customer.id,
    },
  });

  return customer.id;
};

const stripeStatusToSubscriptionStatus = (status: Stripe.Subscription.Status): SubscriptionStatus => {
  switch (status) {
    case 'active':
    case 'trialing':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    default:
      // canceled / incomplete / incomplete_expired / unpaid
      return SubscriptionStatus.INACTIVE;
  }
};

/**
 * Map a Stripe subscription object onto our local row shape. Returns null
 * when the subscription uses a price NorthSign does not own (never upgrades
 * a plan off an unknown price — the caller logs and leaves the row as-is).
 */
export const stripeSubscriptionToUpsertOptions = ({
  organisationId,
  customerId,
  subscription,
}: {
  organisationId: string;
  customerId: string;
  subscription: Stripe.Subscription;
}): Parameters<typeof upsertSubscription>[0] | null => {
  const price = subscription.items.data[0]?.price;

  const plan = price ? mapStripePriceIdToPlan(price.id) : null;

  if (!plan) {
    return null;
  }

  return {
    organisationId,
    provider: BillingProvider.STRIPE,
    plan,
    status: stripeStatusToSubscriptionStatus(subscription.status),
    providerSubscriptionId: subscription.id,
    priceId: price?.id ?? '',
    customerId,
    periodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
    periodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
};

/**
 * Fetch the organisation's current Stripe subscription state and converge the
 * local row. Used after checkout returns (before the webhook lands) and by
 * the admin re-sync surface. No-op when the org has no Stripe customer yet.
 */
export const syncSubscriptionFromStripe = async (organisationId: string): Promise<void> => {
  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    select: {
      customerId: true,
    },
  });

  if (!organisation?.customerId) {
    return;
  }

  const stripe = getStripeClient();

  const subscriptions = await stripe.subscriptions.list({
    customer: organisation.customerId,
    status: 'all',
    limit: 1,
  });

  const liveStatuses = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

  const current = subscriptions.data.find((subscription) => liveStatuses.has(subscription.status));

  if (!current) {
    // No live subscription: converge any existing STRIPE row to INACTIVE so
    // the free-tier usage window honours the last paid period end. Rows from
    // other providers are untouched.
    const existing = await findSubscriptionByOrganisationId(organisationId);

    if (existing?.provider === BillingProvider.STRIPE && existing.status !== SubscriptionStatus.INACTIVE) {
      await updateSubscriptionFlags({
        organisationId,
        status: SubscriptionStatus.INACTIVE,
        cancelAtPeriodEnd: false,
      });
    }

    return;
  }

  const upsertData = stripeSubscriptionToUpsertOptions({
    organisationId,
    customerId: organisation.customerId,
    subscription: current,
  });

  if (!upsertData) {
    return;
  }

  await upsertSubscription(upsertData);
};

export const stripeBillingService: BillingService = {
  provider: BillingProvider.STRIPE,

  async createCheckoutSession({
    organisationId,
    plan,
    interval,
    returnUrl,
  }: CreateCheckoutSessionOptions): Promise<CreateCheckoutSessionResult> {
    const customerId = await getOrCreateStripeCustomer(organisationId);

    const priceId = getStripePriceId(plan, interval);

    const stripe = getStripeClient();

    const baseReturnUrl = returnUrl.startsWith('http') ? returnUrl : `${NEXT_PUBLIC_WEBAPP_URL()}${returnUrl}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Taxes: prices are exclusive of tax; Stripe Tax computes GST/HST/QST
      // from the customer's billing address. B2B tax IDs are collected at
      // checkout. (BILLING.md §2/§4)
      automatic_tax: {
        enabled: true,
      },
      allow_promotion_codes: true,
      tax_id_collection: {
        enabled: true,
      },
      currency: 'cad',
      // No trials in v1 (D-034) — `trial_period_days` is deliberately absent.
      subscription_data: {
        metadata: {
          organisationId,
          plan,
          interval,
        },
      },
      success_url: `${baseReturnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseReturnUrl}?checkout=canceled`,
    });

    if (!session.url) {
      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: 'Failed to create checkout session: Stripe returned no URL',
      });
    }

    return {
      url: session.url,
    };
  },

  async createPortalSession({
    organisationId,
    returnUrl,
  }: CreatePortalSessionOptions): Promise<CreatePortalSessionResult> {
    const customerId = await getOrCreateStripeCustomer(organisationId);

    const stripe = getStripeClient();

    const baseReturnUrl = returnUrl.startsWith('http') ? returnUrl : `${NEXT_PUBLIC_WEBAPP_URL()}${returnUrl}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: baseReturnUrl,
    });

    return {
      url: session.url,
    };
  },

  async handleWebhookEvent(request: Request): Promise<Response> {
    // Business logic lives in stripe-webhook.ts; routed through the service
    // so every entry point crosses the same seam.
    const { handleStripeWebhookRequest } = await import('./stripe-webhook');

    return await handleStripeWebhookRequest(request);
  },

  async syncSubscriptionFromProvider(organisationId: string): Promise<void> {
    await syncSubscriptionFromStripe(organisationId);
  },
};
