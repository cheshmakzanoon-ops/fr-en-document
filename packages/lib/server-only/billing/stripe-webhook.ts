import { prisma } from '@documenso/prisma';
import { BillingProvider, SubscriptionStatus } from '@prisma/client';
import type Stripe from 'stripe';

import {
  getStripeClient,
  getStripeWebhookSecret,
  stripeSubscriptionToUpsertOptions,
  syncSubscriptionFromStripe,
} from './stripe-provider';
import { findSubscriptionByOrganisationId, updateSubscriptionFlags, upsertSubscription } from './subscription-store';

/**
 * Stripe webhook handler (Phase 6, D-033 / BILLING.md §4.2) — TEST MODE.
 *
 * Signature verification: every payload must carry a valid
 * `stripe-signature` header for `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`, or the
 * request is rejected with 400 before any code runs.
 *
 * Idempotency: all writes are convergent upserts keyed on the Stripe
 * subscription id (`planId @unique` → one row per organisation, one row per
 * provider subscription). Replaying any event — Stripe retries, `stripe
 * trigger`, double-delivered events — converges to the same row. Events that
 * are not ours are acknowledged with 200 and ignored.
 */
type WebhookResponse = {
  received: boolean;
  message?: string;
};

const okResponse = (): Response => {
  return Response.json({ received: true } satisfies WebhookResponse, { status: 200 });
};

const errorResponse = (message: string, status: number): Response => {
  return Response.json({ received: false, message } satisfies WebhookResponse, { status });
};

const customerIdOf = (
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null => {
  if (!customer) {
    return null;
  }

  return typeof customer === 'string' ? customer : customer.id;
};

const findOrganisationIdByCustomer = async (customerId: string): Promise<string | null> => {
  const organisation = await prisma.organisation.findUnique({
    where: {
      customerId,
    },
    select: {
      id: true,
    },
  });

  return organisation?.id ?? null;
};

export const handleStripeWebhookRequest = async (request: Request): Promise<Response> => {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return errorResponse('No signature found in request', 400);
  }

  const payload = await request.text();

  if (!payload) {
    return errorResponse('No payload found in request', 400);
  }

  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('[billing] Stripe webhook signature verification failed', err);

    return errorResponse('Webhook signature verification failed.', 400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        await handleCheckoutSessionCompleted(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        await handleSubscriptionUpsert(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;

        await handleInvoicePaymentFailed(invoice);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        await handleInvoicePaid(invoice);
        break;
      }
      default:
        // Acknowledge every other event type (payment_intent.*, etc.).
        break;
    }

    return okResponse();
  } catch (err) {
    console.error(`[billing] Failed to handle Stripe webhook event ${event.type} (${event.id})`, err);

    // Return 500 so Stripe retries; convergent upserts make retries safe.
    return errorResponse('Webhook handler failed.', 500);
  }
};

/**
 * checkout.session.completed — subscription mode only. The customer id is
 * already stored on the organisation when the session was created, so we
 * look the org up by customer and converge its subscription state from
 * Stripe (the session object does not carry the current periods).
 */
const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session): Promise<void> => {
  if (session.mode !== 'subscription') {
    return;
  }

  const customerId = customerIdOf(session.customer);

  if (!customerId || typeof session.subscription !== 'string') {
    return;
  }

  const organisationId = await findOrganisationIdByCustomer(customerId);

  if (!organisationId) {
    console.warn(`[billing] checkout.session.completed for unknown customer ${customerId}, ignoring`);

    return;
  }

  await syncSubscriptionFromStripe(organisationId);
};

const handleSubscriptionUpsert = async (subscription: Stripe.Subscription): Promise<void> => {
  const customerId = customerIdOf(subscription.customer);

  if (!customerId) {
    return;
  }

  const organisationId = await findOrganisationIdByCustomer(customerId);

  if (!organisationId) {
    console.warn(`[billing] customer.subscription.updated for unknown customer ${customerId}, ignoring`);

    return;
  }

  const upsertData = stripeSubscriptionToUpsertOptions({
    organisationId,
    customerId,
    subscription,
  });

  if (!upsertData) {
    console.warn(
      `[billing] customer.subscription.updated for subscription ${subscription.id} uses an unknown price; leaving the local row unchanged`,
    );

    return;
  }

  await upsertSubscription(upsertData);
};

/**
 * customer.subscription.deleted — Stripe's default period-end behavior has
 * ended the subscription (no custom dunning in v1). Mark INACTIVE and keep
 * the row so the free-tier usage window honours the last paid period end.
 */
const handleSubscriptionDeleted = async (subscription: Stripe.Subscription): Promise<void> => {
  const customerId = customerIdOf(subscription.customer);

  if (!customerId) {
    return;
  }

  const organisationId = await findOrganisationIdByCustomer(customerId);

  if (!organisationId) {
    return;
  }

  const existing = await findSubscriptionByOrganisationId(organisationId);

  if (!existing || existing.provider !== BillingProvider.STRIPE) {
    return;
  }

  await updateSubscriptionFlags({
    organisationId,
    status: SubscriptionStatus.INACTIVE,
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
    periodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : undefined,
  });
};

/**
 * invoice.payment_failed — log + flag the account (PAST_DUE banner in the
 * UI). No custom dunning: Stripe retries per its default schedule and ends
 * the subscription at period end if payment never lands.
 */
const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice): Promise<void> => {
  const customerId = customerIdOf(invoice.customer);

  if (!customerId) {
    return;
  }

  const organisationId = await findOrganisationIdByCustomer(customerId);

  if (!organisationId) {
    return;
  }

  const existing = await findSubscriptionByOrganisationId(organisationId);

  if (!existing || existing.provider !== BillingProvider.STRIPE) {
    return;
  }

  console.warn(
    `[billing] invoice.payment_failed for organisation ${organisationId} (${invoice.id}) — flagging PAST_DUE`,
  );

  await updateSubscriptionFlags({
    organisationId,
    status: SubscriptionStatus.PAST_DUE,
    paymentFailedAt: new Date(),
  });
};

/**
 * invoice.paid — a payment landed; clear the PAST_DUE flag and banner.
 * `customer.subscription.updated` converges status/periods afterwards.
 */
const handleInvoicePaid = async (invoice: Stripe.Invoice): Promise<void> => {
  const customerId = customerIdOf(invoice.customer);

  if (!customerId) {
    return;
  }

  const organisationId = await findOrganisationIdByCustomer(customerId);

  if (!organisationId) {
    return;
  }

  const existing = await findSubscriptionByOrganisationId(organisationId);

  if (!existing || existing.provider !== BillingProvider.STRIPE) {
    return;
  }

  await updateSubscriptionFlags({
    organisationId,
    status: existing.status === SubscriptionStatus.PAST_DUE ? SubscriptionStatus.ACTIVE : undefined,
    paymentFailedAt: null,
  });
};
