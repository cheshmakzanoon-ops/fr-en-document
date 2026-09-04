import type { BillingPlanType, BillingProvider } from '@prisma/client';

import { env } from '../../utils/env';
import { mockBillingService } from './mock-provider';
import type { BillingInterval } from './plans';
import { stripeBillingService } from './stripe-provider';

export type { BillingInterval };

export type CreateCheckoutSessionOptions = {
  /**
   * The organisation buying the plan. Providers resolve the billing contact
   * (owner) themselves so the seam stays organisation-centric.
   */
  organisationId: string;
  plan: BillingPlanType;
  interval: BillingInterval;

  /**
   * Where the provider sends the customer after checkout completes/cancels.
   * Must be an app URL — providers never navigate anywhere else.
   */
  returnUrl: string;
};

export type CreateCheckoutSessionResult = {
  url: string;
};

export type CreatePortalSessionOptions = {
  organisationId: string;
  returnUrl: string;
};

export type CreatePortalSessionResult = {
  url: string;
};

/**
 * BillingService — the only billing seam in the codebase (Phase 6, D-033).
 *
 * Every billing entry point in the app (checkout, portal, webhook, provider
 * re-sync) goes through this interface. `getBillingService()` returns the
 * implementation selected by `BILLING_PROVIDER` (default `mock`). CI and
 * local dev run mock; `stripe` is test-mode only. No code outside the two
 * providers may import the Stripe SDK or know about webhook signatures.
 */
export interface BillingService {
  readonly provider: BillingProvider;

  /**
   * Create a checkout session (subscription mode) for the given plan and
   * return the URL the customer should be redirected to.
   */
  createCheckoutSession(options: CreateCheckoutSessionOptions): Promise<CreateCheckoutSessionResult>;

  /**
   * Create a customer-portal session (self-serve upgrade/cancel/payment
   * method/invoices).
   */
  createPortalSession(options: CreatePortalSessionOptions): Promise<CreatePortalSessionResult>;

  /**
   * Handle a webhook POST body for this provider. Signature verification
   * (when the provider has one) happens inside the implementation.
   */
  handleWebhookEvent(request: Request): Promise<Response>;

  /**
   * Pull the current provider truth for the organisation's subscription and
   * converge the local row (used on the billing page right after checkout
   * returns, before the async webhook arrives).
   */
  syncSubscriptionFromProvider(organisationId: string): Promise<void>;
}

let cachedBillingService: BillingService | null = null;

/**
 * Resolve the billing provider from `BILLING_PROVIDER`. Anything other than
 * the literal `stripe` resolves to the mock provider — including an unset
 * variable — so CI and fresh checkouts are mock by default (D-033).
 */
export const getBillingService = (): BillingService => {
  if (!cachedBillingService) {
    const provider = env('BILLING_PROVIDER') === 'stripe' ? stripeBillingService : mockBillingService;

    cachedBillingService = provider;
  }

  return cachedBillingService;
};

/**
 * Test helper: drop the cached provider so a test can flip `BILLING_PROVIDER`
 * and re-resolve. Never called by application code.
 */
export const resetBillingServiceCache = (): void => {
  cachedBillingService = null;
};
