import { BillingPlanType } from '@documenso/prisma/generated/types';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const checkoutMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/billing/checkout',
    summary: 'Create a billing checkout session',
    description: 'Create a provider checkout session (subscription mode) for the given plan and interval.',
    tags: ['Billing'],
  },
};

const ZBillingIntervalSchema = z.enum(['monthly', 'annual']);

/**
 * Only Pro and Business are purchasable — the free Starter plan cannot be
 * "bought" (it is the absence of a subscription; D-034).
 */
export const ZCheckoutRequestSchema = z.object({
  organisationId: z.string().describe('The organisation to subscribe.'),
  plan: z
    .nativeEnum(BillingPlanType)
    .refine((plan) => plan !== BillingPlanType.STARTER, {
      message: 'The Starter plan is free and cannot be purchased.',
    })
    .describe('The plan to purchase (PRO or BUSINESS).'),
  interval: ZBillingIntervalSchema.describe('Billing interval: monthly or annual.'),
  returnPath: z
    .string()
    .default('/settings/billing')
    .describe('App path to return to after checkout completes or is cancelled.'),
});

export const ZCheckoutResponseSchema = z.object({
  url: z.string().describe('The provider checkout URL the caller should redirect to.'),
});

export type TCheckoutRequest = z.infer<typeof ZCheckoutRequestSchema>;
export type TCheckoutResponse = z.infer<typeof ZCheckoutResponseSchema>;
