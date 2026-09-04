import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import {
  mockCustomerId,
  mockPriceId,
  mockSubscriptionId,
  upsertSubscription,
} from '@documenso/lib/server-only/billing';
import { env } from '@documenso/lib/utils/env';
import { prisma } from '@documenso/prisma';
import { BillingPlanType, BillingProvider, SubscriptionStatus } from '@prisma/client';
import { DateTime } from 'luxon';
import { redirect } from 'react-router';

import type { Route } from './+types/billing.mock.checkout';

/**
 * Mock billing checkout completion (Phase 6, D-033). Only reachable when the
 * billing provider is the mock — CI/local. Validates the caller owns the
 * target organisation, grants/updates the plan synchronously (no webhooks,
 * no network), and redirects back into the app.
 *
 * The Stripe provider never produces URLs that point here.
 */
const isMockBillingProvider = (): boolean => {
  return env('BILLING_PROVIDER') !== 'stripe';
};

const VALID_PLANS = new Set<BillingPlanType>([BillingPlanType.PRO, BillingPlanType.BUSINESS]);

export async function loader({ request }: Route.LoaderArgs) {
  if (!isMockBillingProvider()) {
    throw redirect('/settings/billing');
  }

  const session = await getOptionalSession(request);

  if (!session.isAuthenticated) {
    throw redirect('/signin');
  }

  const url = new URL(request.url);

  const organisationId = url.searchParams.get('org');
  const planParam = url.searchParams.get('plan');
  const intervalParam = url.searchParams.get('interval');
  const returnPath = url.searchParams.get('return') ?? '/settings/billing';

  const plan = planParam as BillingPlanType | null;
  const interval = intervalParam === 'annual' ? 'annual' : intervalParam === 'monthly' ? 'monthly' : null;

  if (!organisationId || !plan || !VALID_PLANS.has(plan) || !interval) {
    throw redirect('/settings/billing');
  }

  // Only honour same-origin app paths as the return target.
  const isSafeReturnPath = returnPath.startsWith('/') && !returnPath.startsWith('//');

  if (!isSafeReturnPath) {
    throw redirect('/settings/billing');
  }

  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    select: {
      ownerUserId: true,
    },
  });

  if (!organisation || organisation.ownerUserId !== session.user.id) {
    throw redirect('/settings/billing');
  }

  const now = DateTime.utc();

  const periodEnd = interval === 'annual' ? now.plus({ years: 1 }) : now.plus({ months: 1 });

  await upsertSubscription({
    organisationId,
    provider: BillingProvider.MOCK,
    plan,
    status: SubscriptionStatus.ACTIVE,
    providerSubscriptionId: mockSubscriptionId(organisationId),
    priceId: mockPriceId(plan, interval),
    customerId: mockCustomerId(organisationId),
    periodStart: now.toJSDate(),
    periodEnd: periodEnd.toJSDate(),
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
  });

  throw redirect(`${returnPath}?upgraded=${plan}`);
}
