import { getBillingService } from '@documenso/lib/server-only/billing';

import type { Route } from './+types/stripe.webhook';

/**
 * NorthSign billing webhook endpoint (Phase 6, D-031). Replaces the upstream
 * proxy to the EE (COMMERCIAL) Stripe module — see BILLING.md §1/§4.
 *
 * Under `BILLING_PROVIDER=mock` (CI/local default) the request is
 * acknowledged and ignored. Under `BILLING_PROVIDER=stripe` (test mode) the
 * payload is signature-verified with NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET and
 * converged into the local subscription row.
 */
export async function action({ request }: Route.ActionArgs) {
  return await getBillingService().handleWebhookEvent(request);
}
