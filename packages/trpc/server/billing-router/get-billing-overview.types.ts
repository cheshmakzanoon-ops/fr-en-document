import { BillingPlanType } from '@documenso/prisma/generated/types';
import { z } from 'zod';

/**
 * NorthSign billing overview (Phase 6, D-035). One entry per organisation the
 * caller owns — the only organisations a user can manage billing for in v1
 * (org-level billing roles arrive with teams in Phase 8).
 *
 * The numbers shown on /settings/billing and in the limit banners are all
 * derived server-side from the subscription row + the usage journal so the
 * client never re-implements entitlement math.
 */
export const ZGetBillingOverviewResponseSchema = z
  .object({
    organisationId: z.string(),
    organisationName: z.string(),
    organisationUrl: z.string(),

    /**
     * Effective plan (STARTER when no paid subscription row exists).
     */
    plan: z.nativeEnum(BillingPlanType),

    /**
     * True when the row is a live NorthSign paid subscription (mock or
     * stripe). False = free Starter plan.
     */
    isPaid: z.boolean(),

    /**
     * Billing provider that manages the row; null on the free plan.
     */
    provider: z.string().nullable(),
    status: z.string().nullable(),

    /**
     * Start of the current usage window (paid billing period or free-trial
     * month window). Documents sent on/after this instant count as used.
     */
    periodStart: z.date(),
    periodEnd: z.date().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    paymentFailedAt: z.date().nullable(),

    /**
     * Plan limits (null = unlimited).
     */
    documentsPerPeriod: z.number().nullable(),
    recipientsPerDocument: z.number().nullable(),
    allowsTemplates: z.boolean(),
    allowsApi: z.boolean(),

    /**
     * Usage this period.
     */
    sentThisPeriod: z.number(),
    remaining: z.number().nullable(),
    hasReachedLimit: z.boolean(),
    isNearingLimit: z.boolean(),
  })
  .array();

export type TGetBillingOverviewResponse = z.infer<typeof ZGetBillingOverviewResponseSchema>;
