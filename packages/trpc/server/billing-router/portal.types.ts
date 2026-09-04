import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const portalMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/billing/portal',
    summary: 'Create a billing portal session',
    description: 'Create a provider customer-portal session for self-serve plan/card/invoice management.',
    tags: ['Billing'],
  },
};

export const ZPortalRequestSchema = z.object({
  organisationId: z.string().describe('The organisation whose billing to manage.'),
});

export const ZPortalResponseSchema = z.object({
  url: z.string().describe('The provider portal URL the caller should redirect to.'),
});

export type TPortalRequest = z.infer<typeof ZPortalRequestSchema>;
export type TPortalResponse = z.infer<typeof ZPortalResponseSchema>;
