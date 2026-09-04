import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getBillingService } from '@documenso/lib/server-only/billing';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { portalMeta, ZPortalRequestSchema, ZPortalResponseSchema } from './portal.types';

/**
 * Only the organisation owner may open its billing portal in v1.
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

export const billingPortalRoute = authenticatedProcedure
  .meta(portalMeta)
  .input(ZPortalRequestSchema)
  .output(ZPortalResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;

    await assertUserOwnsOrganisation(ctx.user.id, organisationId);

    const billingService = getBillingService();

    const { url } = await billingService.createPortalSession({
      organisationId,
      returnUrl: '/settings/billing',
    });

    return { url };
  });
