import { type BillingPlanType, BillingProvider } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import type {
  BillingService,
  CreateCheckoutSessionOptions,
  CreateCheckoutSessionResult,
  CreatePortalSessionOptions,
  CreatePortalSessionResult,
} from './billing-service';
import type { BillingInterval } from './plans';

/**
 * Mock billing provider (Phase 6, D-033) — CI/local default, zero secrets.
 *
 * Checkout is a local round-trip: the returned URL is the app's own
 * `/api/billing/mock/checkout` route which grants/updates the plan
 * synchronously and redirects back to the caller. The portal returns a
 * harmless in-app URL. Webhooks are acknowledged and ignored. Everything is
 * deterministic and offline.
 */
const MOCK_CHECKOUT_PATH = '/api/billing/mock/checkout';

export const mockCheckoutUrl = (
  plan: BillingPlanType,
  interval: BillingInterval,
  returnUrl: string,
  organisationId: string,
): string => {
  const url = new URL(`${NEXT_PUBLIC_WEBAPP_URL()}${MOCK_CHECKOUT_PATH}`);

  url.searchParams.set('org', organisationId);
  url.searchParams.set('plan', plan);
  url.searchParams.set('interval', interval);
  url.searchParams.set('return', returnUrl);

  return url.toString();
};

export const mockPortalUrl = (): string => {
  return `${NEXT_PUBLIC_WEBAPP_URL()}/settings/billing?mock_portal=1`;
};

export const mockBillingService: BillingService = {
  provider: BillingProvider.MOCK,

  createCheckoutSession({
    organisationId,
    plan,
    interval,
    returnUrl,
  }: CreateCheckoutSessionOptions): Promise<CreateCheckoutSessionResult> {
    return Promise.resolve({
      url: mockCheckoutUrl(plan, interval, returnUrl, organisationId),
    });
  },

  createPortalSession(_options: CreatePortalSessionOptions): Promise<CreatePortalSessionResult> {
    return Promise.resolve({
      url: mockPortalUrl(),
    });
  },

  handleWebhookEvent(_request: Request): Promise<Response> {
    // The mock provider never receives provider webhooks; acknowledge so any
    // stray POST to /api/stripe/webhook under mock mode is a silent no-op.
    return Promise.resolve(
      Response.json(
        {
          success: true,
          message: 'Mock billing provider received webhook',
        },
        { status: 200 },
      ),
    );
  },

  syncSubscriptionFromProvider(_organisationId: string): Promise<void> {
    // Mock grants are written synchronously by the checkout route — there is
    // no remote truth to converge with.
    return Promise.resolve();
  },
};
