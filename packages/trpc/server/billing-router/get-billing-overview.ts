import {
  countDocumentsSentByOrganisationSince,
  getDocumentsRemaining,
  getEntitlement,
  hasReachedDocumentLimit,
  isNearingDocumentLimit,
  isPaidSubscription,
} from '@documenso/lib/server-only/billing';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZGetBillingOverviewResponseSchema } from './get-billing-overview.types';

/**
 * Billing overview for every organisation the caller owns (Phase 6, D-035).
 *
 * Ownership is the v1 billing rule (the mock checkout route and the Stripe
 * provider both treat the organisation owner as the billing contact); roles
 * beyond owner arrive with teams in Phase 8.
 */
export const getBillingOverviewRoute = authenticatedProcedure
  .output(ZGetBillingOverviewResponseSchema)
  .query(async ({ ctx }) => {
    const organisations = await prisma.organisation.findMany({
      where: {
        ownerUserId: ctx.user.id,
      },
      select: {
        id: true,
        name: true,
        url: true,
        subscription: true,
      },
    });

    return await Promise.all(
      organisations.map(async (organisation) => {
        const entitlement = getEntitlement(organisation.subscription);

        const sentThisPeriod = await countDocumentsSentByOrganisationSince({
          organisationId: organisation.id,
          since: entitlement.periodStart,
        });

        const subscription = organisation.subscription;

        return {
          organisationId: organisation.id,
          organisationName: organisation.name,
          organisationUrl: organisation.url,

          plan: entitlement.plan,
          isPaid: isPaidSubscription(subscription),
          provider: subscription?.provider ?? null,
          status: subscription?.status ?? null,
          periodStart: entitlement.periodStart,
          periodEnd: entitlement.periodEnd,
          cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
          paymentFailedAt: subscription?.paymentFailedAt ?? null,

          documentsPerPeriod: entitlement.documentsPerPeriod,
          recipientsPerDocument: entitlement.recipientsPerDocument,
          allowsTemplates: entitlement.allowsTemplates,
          allowsApi: entitlement.allowsApi,

          sentThisPeriod,
          remaining: getDocumentsRemaining(entitlement, sentThisPeriod),
          hasReachedLimit: hasReachedDocumentLimit(entitlement, sentThisPeriod),
          isNearingLimit: isNearingDocumentLimit(entitlement, sentThisPeriod),
        };
      }),
    );
  });
