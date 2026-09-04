import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getBillingService } from '@documenso/lib/server-only/billing';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { checkoutMeta, ZCheckoutRequestSchema, ZCheckoutResponseSchema } from './checkout.types';

/**
 * Only the organisation owner may start a checkout for it in v1 (see
 * get-billing-overview). Mirrors the ownership rule enforced by the mock
 * checkout completion route and the Stripe provider's billing contact.
 */
const assertUserOwnsOrganisation = async (userId: number, organisationId: string): Promise<void> => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
      ownerUserId: userId,
    },
    select: {
      id: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
      statusCode: 404,
    });
  }
};

export const billingCheckoutRoute = authenticatedProcedure
  .meta(checkoutMeta)
  .input(ZCheckoutRequestSchema)
  .output(ZCheckoutResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, plan, interval } = input;

    // Only same-origin app paths are honoured as the return target.
    const returnPath =
      input.returnPath.startsWith('/') && !input.returnPath.startsWith('//') ? input.returnPath : '/settings/billing';

    await assertUserOwnsOrganisation(ctx.user.id, organisationId);

    const billingService = getBillingService();

    const { url } = await billingService.createCheckoutSession({
      organisationId,
      plan,
      interval,
      returnUrl: returnPath,
    });

    return { url };
  });
