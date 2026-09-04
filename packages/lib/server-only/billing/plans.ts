import { BillingPlanType } from '@prisma/client';

/**
 * NorthSign billing plan catalog (Phase 6, DECISIONS.md D-031..D-034).
 *
 * Single source of truth for what each plan allows and what it costs.
 * Prices are CAD cents, displayed exclusive of tax — Stripe Tax calculates
 * GST/HST/QST at checkout. The free Starter plan is the product's trial:
 * there are no trial periods anywhere (D-034).
 */
export type BillingInterval = 'monthly' | 'annual';

export type NorthSignPlanDefinition = {
  plan: BillingPlanType;

  /**
   * Max documents a sender may first-send per billing period.
   * `null` = unlimited.
   */
  documentsPerPeriod: number | null;

  /**
   * Max recipients on a single sent document. `null` = unlimited.
   */
  recipientsPerDocument: number | null;

  /**
   * Templates (create / save-as-template / use / direct link) are Pro+.
   */
  allowsTemplates: boolean;

  /**
   * API access (token creation + API requests) is Pro+.
   */
  allowsApi: boolean;

  /**
   * Team features. Reserved for Phase 8 enforcement — Business currently
   * sells the entitlement; nothing else in v1 reads it.
   */
  allowsTeams: boolean;

  /**
   * Monthly price in CAD cents. 0 for the free plan.
   */
  monthlyPriceCents: number;

  /**
   * Annual price in CAD cents (two months free on every paid plan).
   */
  annualPriceCents: number;
};

export const BILLING_PLANS: Record<BillingPlanType, NorthSignPlanDefinition> = {
  [BillingPlanType.STARTER]: {
    plan: BillingPlanType.STARTER,
    // 3 documents sent/month; recipients capped at 2 per document; no
    // templates; no API. Per-recipient locale is NOT gated — bilingual
    // signing is the NorthSign brand differentiator (BILLING.md §2).
    documentsPerPeriod: 3,
    recipientsPerDocument: 2,
    allowsTemplates: false,
    allowsApi: false,
    allowsTeams: false,
    monthlyPriceCents: 0,
    annualPriceCents: 0,
  },
  [BillingPlanType.PRO]: {
    plan: BillingPlanType.PRO,
    documentsPerPeriod: null,
    recipientsPerDocument: null,
    allowsTemplates: true,
    allowsApi: true,
    allowsTeams: false,
    monthlyPriceCents: 1900, // $19 CAD/mo
    annualPriceCents: 19000, // $190 CAD/yr
  },
  [BillingPlanType.BUSINESS]: {
    plan: BillingPlanType.BUSINESS,
    documentsPerPeriod: null,
    recipientsPerDocument: null,
    allowsTemplates: true,
    allowsApi: true,
    allowsTeams: true,
    monthlyPriceCents: 4900, // $49 CAD/mo
    annualPriceCents: 49000, // $490 CAD/yr
  },
};

export const priceForPlan = (plan: BillingPlanType, interval: BillingInterval): number => {
  return interval === 'monthly' ? BILLING_PLANS[plan].monthlyPriceCents : BILLING_PLANS[plan].annualPriceCents;
};

/**
 * Human-friendly price string, e.g. "$19" for a $19 CAD plan. Prices are
 * rendered locale-aware (fr-CA) on the client through `i18n.number`; this
 * helper is for server-side/email-ish contexts only.
 */
export const formatPriceCents = (cents: number): string => {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} CAD`;
};

export const isPaidPlan = (plan: BillingPlanType): boolean => plan !== BillingPlanType.STARTER;
