import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { BILLING_PLANS, type BillingInterval, priceForPlan } from '@documenso/lib/server-only/billing/plans';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { BillingPlanType } from '@prisma/client';
import { Check, Minus, SparklesIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { AppFooter } from '~/components/general/app-footer';
import { BrandingLogo } from '~/components/general/branding-logo';
import { formatCadPrice } from '~/utils/format-cad';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Pricing`);
}

type PlanCtaState = { plan: BillingPlanType; interval: BillingInterval } | null;

const PLAN_ORDER = [BillingPlanType.STARTER, BillingPlanType.PRO, BillingPlanType.BUSINESS];

// Brand tier names stay untranslated (proper nouns) — see REVIEW-NOTES Phase 6.
const PLAN_LABEL: Record<BillingPlanType, MessageDescriptor> = {
  [BillingPlanType.STARTER]: msg`Starter`,
  [BillingPlanType.PRO]: msg`Pro`,
  [BillingPlanType.BUSINESS]: msg`Business`,
};

const PLAN_TAGLINE: Record<BillingPlanType, MessageDescriptor> = {
  [BillingPlanType.STARTER]: msg`For occasional signing and trying NorthSign.`,
  [BillingPlanType.PRO]: msg`For professionals who send documents every day.`,
  [BillingPlanType.BUSINESS]: msg`For teams that need priority support and shared workflows.`,
};

const PLAN_CHOOSE_CTA: Record<BillingPlanType, MessageDescriptor | null> = {
  [BillingPlanType.STARTER]: null,
  [BillingPlanType.PRO]: msg`Choose Pro`,
  [BillingPlanType.BUSINESS]: msg`Choose Business`,
};

export default function PricingPage() {
  const { i18n, t } = useLingui();

  const cad = (cents: number): string => formatCadPrice(cents, i18n.locale === 'fr' ? 'fr-CA' : 'en-CA');

  const checkoutMutation = trpc.billing.checkout.useMutation();

  const location = useLocation();
  const navigate = useNavigate();

  const { sessionData } = useOptionalSession();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    searchParams.get('interval') === 'annual' ? 'annual' : 'monthly',
  );
  const [pendingCta, setPendingCta] = useState<PlanCtaState>(null);

  // The first organisation the signed-in user owns is the billing subject in
  // v1 (org billing roles arrive with teams in Phase 8).
  const ownedOrganisationId = useMemo(() => {
    const user = sessionData?.user;
    const organisations = sessionData?.organisations ?? [];

    if (!user) {
      return null;
    }

    return organisations.find((organisation) => organisation.ownerUserId === user.id)?.id ?? null;
  }, [sessionData]);

  const { data: currentPlans } = trpc.billing.getBillingOverview.useQuery(undefined, {
    enabled: Boolean(ownedOrganisationId),
  });

  const currentPlan = currentPlans?.find((entry) => entry.organisationId === ownedOrganisationId)?.plan ?? null;

  const isAnnual = billingInterval === 'annual';

  const handleSelectPlan = async (plan: BillingPlanType) => {
    if (plan === BillingPlanType.STARTER) {
      await navigate('/signup');
      return;
    }

    // Signed out: sign in first, then return to this page with the choice
    // pre-selected so the next click goes straight to checkout.
    if (!ownedOrganisationId) {
      const returnTo = encodeURIComponent(`/pricing?plan=${plan}&interval=${billingInterval}`);

      await navigate(`/signin?returnTo=${returnTo}`);
      return;
    }

    setPendingCta({ plan, interval: billingInterval });

    try {
      const { url } = await checkoutMutation.mutateAsync({
        organisationId: ownedOrganisationId,
        plan,
        interval: billingInterval,
        returnPath: '/settings/billing',
      });

      window.location.assign(url);
    } catch {
      setPendingCta(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-4 py-5 md:px-8">
        <Link to="/signin" aria-label={t`NorthSign home`} className="text-foreground">
          <BrandingLogo className="h-6 w-auto" />
        </Link>

        <nav className="flex items-center gap-3">
          {sessionData?.user ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <Trans>Open app</Trans>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/signin">
                <Trans>Sign in</Trans>
              </Link>
            </Button>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 pb-24 md:px-8">
        {/* Hero */}
        <section className="mx-auto mt-10 max-w-3xl text-center md:mt-16">
          <Badge variant="neutral" className="bg-primary/10 text-primary hover:bg-primary/10">
            <Trans>Canadian-hosted e-signatures</Trans>
          </Badge>

          <h1 className="mt-6 text-balance font-bold text-4xl tracking-tight md:text-6xl">
            <Trans>Simple, transparent pricing for signing in Canada</Trans>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            <Trans>
              Start free — no credit card, no trial clock. Upgrade when your team needs unlimited sends, templates, or
              the API.
            </Trans>
          </p>

          {/* Interval toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="inline-flex items-center rounded-full border bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setBillingInterval('monthly')}
                className={cn(
                  'rounded-full px-4 py-1.5 font-medium text-sm transition-colors',
                  !isAnnual ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Trans>Monthly</Trans>
              </button>

              <button
                type="button"
                onClick={() => setBillingInterval('annual')}
                className={cn(
                  'rounded-full px-4 py-1.5 font-medium text-sm transition-colors',
                  isAnnual ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Trans>Annual</Trans>
                <span className="ml-1.5 font-semibold text-primary text-xs">−17%</span>
              </button>
            </div>
          </div>

          <p className="mt-3 text-muted-foreground text-sm">
            <Trans>Prices in CAD, exclusive of GST/HST/QST. Taxes are calculated at checkout.</Trans>
          </p>
        </section>

        {/* Plan cards */}
        <section className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3 md:items-stretch">
          {PLAN_ORDER.map((plan) => {
            const definition = BILLING_PLANS[plan];
            const isHighlighted = plan === BillingPlanType.PRO;
            const isCurrent = currentPlan === plan;
            const price = priceForPlan(plan, billingInterval);
            const ctaPending = pendingCta?.plan === plan && pendingCta?.interval === billingInterval;
            const chooseCta = PLAN_CHOOSE_CTA[plan];
            const returnTo = encodeURIComponent(`/pricing?plan=${plan}&interval=${billingInterval}`);

            return (
              <div
                key={plan}
                className={cn(
                  'flex flex-col rounded-xl border bg-card p-6',
                  isHighlighted ? 'border-primary/60 shadow-lg shadow-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-lg">{t(PLAN_LABEL[plan])}</h2>

                  {isHighlighted && (
                    <Badge className="bg-primary text-primary-foreground">
                      <SparklesIcon className="mr-1 h-3 w-3" />
                      <Trans>Most popular</Trans>
                    </Badge>
                  )}

                  {isCurrent && (
                    <Badge variant="secondary">
                      <Trans>Current plan</Trans>
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-muted-foreground text-sm">{t(PLAN_TAGLINE[plan])}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-bold text-4xl tracking-tight">{price === 0 ? t`$0` : cad(price)}</span>

                  {price > 0 && (
                    <span className="text-muted-foreground text-sm">{isAnnual ? t`/year` : t`/month`}</span>
                  )}
                </div>

                <p className="mt-1 text-muted-foreground text-sm">
                  {price === 0
                    ? t`Free forever. No credit card required.`
                    : isAnnual
                      ? t`Billed yearly.`
                      : t`Billed monthly.`}
                </p>

                <Separator className="my-6" />

                <ul className="flex flex-1 flex-col gap-3 text-sm">
                  <PlanFeature
                    label={
                      definition.documentsPerPeriod === null
                        ? t`Unlimited documents sent`
                        : t`${definition.documentsPerPeriod} documents sent per month`
                    }
                  />

                  <PlanFeature
                    label={
                      definition.recipientsPerDocument === null
                        ? t`Unlimited recipients per document`
                        : t`${definition.recipientsPerDocument} recipients per document`
                    }
                  />

                  <PlanFeature label={t`Per-recipient English and French signing`} />

                  {definition.allowsTemplates && <PlanFeature label={t`Templates to send in one click`} />}
                  {definition.allowsApi && <PlanFeature label={t`Full API access`} />}
                  {definition.allowsTeams && <PlanFeature label={t`Team features with shared workflows`} />}

                  <PlanFeature
                    label={
                      plan === BillingPlanType.STARTER
                        ? t`Community support`
                        : plan === BillingPlanType.PRO
                          ? t`Standard email support`
                          : t`Priority email support`
                    }
                  />
                </ul>

                {isCurrent ? (
                  <Button disabled className="mt-8 w-full">
                    <Trans>Current plan</Trans>
                  </Button>
                ) : plan === BillingPlanType.STARTER ? (
                  <Button asChild className="mt-8 w-full">
                    <Link to="/signup">
                      <Trans>Start for free</Trans>
                    </Link>
                  </Button>
                ) : !ownedOrganisationId && chooseCta ? (
                  <Button asChild className="mt-8 w-full">
                    <Link to={`/signin?returnTo=${returnTo}`} className="w-full">
                      {t(chooseCta)}
                    </Link>
                  </Button>
                ) : chooseCta ? (
                  <Button
                    loading={ctaPending}
                    onClick={() => void handleSelectPlan(plan)}
                    className={cn(
                      'mt-8 w-full',
                      !isHighlighted && 'bg-foreground text-background hover:bg-foreground/90',
                    )}
                  >
                    {t(chooseCta)}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </section>

        {/* Comparison table */}
        <section className="mx-auto mt-20 max-w-5xl">
          <h2 className="text-center font-bold text-2xl tracking-tight md:text-3xl">
            <Trans>Compare plans</Trans>
          </h2>

          <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-4 font-medium text-muted-foreground">
                    <Trans>Feature</Trans>
                  </th>

                  {PLAN_ORDER.map((plan) => (
                    <th key={plan} className="p-4 text-center">
                      <div className="font-semibold">{t(PLAN_LABEL[plan])}</div>
                      <div className="font-normal text-muted-foreground text-xs">
                        {plan === BillingPlanType.STARTER
                          ? t`Free`
                          : `${cad(priceForPlan(plan, 'monthly'))} ${t`/month`}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <ComparisonRow label={<Trans>Documents sent per month</Trans>}>
                  <TextCell>{t`3`}</TextCell>
                  <CheckCell label={t`Unlimited`} />
                  <CheckCell label={t`Unlimited`} />
                </ComparisonRow>

                <ComparisonRow label={<Trans>Recipients per document</Trans>}>
                  <TextCell>{t`2`}</TextCell>
                  <CheckCell label={t`Unlimited`} />
                  <CheckCell label={t`Unlimited`} />
                </ComparisonRow>

                <ComparisonRow label={<Trans>Templates</Trans>}>
                  <DashCell />
                  <CheckCell label={t`Included`} />
                  <CheckCell label={t`Included`} />
                </ComparisonRow>

                <ComparisonRow label={<Trans>API access</Trans>}>
                  <DashCell />
                  <CheckCell label={t`Included`} />
                  <CheckCell label={t`Included`} />
                </ComparisonRow>

                <ComparisonRow label={<Trans>Per-recipient locale (EN / fr-CA signing emails)</Trans>}>
                  <CheckCell label={t`Included`} />
                  <CheckCell label={t`Included`} />
                  <CheckCell label={t`Included`} />
                </ComparisonRow>

                <ComparisonRow label={<Trans>Team features</Trans>}>
                  <DashCell />
                  <DashCell />
                  <CheckCell label={t`Included`} />
                </ComparisonRow>

                <ComparisonRow label={<Trans>Support</Trans>}>
                  <TextCell>{t`Community`}</TextCell>
                  <TextCell>{t`Standard`}</TextCell>
                  <TextCell>{t`Priority`}</TextCell>
                </ComparisonRow>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-center text-muted-foreground text-sm">
            <Trans>
              Business includes team features, which ship in a later release. Business accounts keep today's price until
              then.
            </Trans>
          </p>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto mt-20 max-w-3xl rounded-2xl bg-primary p-8 text-center text-primary-foreground md:p-12">
          <h2 className="text-balance font-bold text-2xl tracking-tight md:text-3xl">
            <Trans>Ready to send your first bilingual document?</Trans>
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
            <Trans>
              Sign up free and send 3 documents a month, with up to 2 recipients each — per-recipient English and French
              signing included on every plan.
            </Trans>
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
              <Link to="/signup">
                <Trans>Get started free</Trans>
              </Link>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/signin?returnTo=%2Fpricing%3Fplan%3DPRO">
                <Trans>Talk to us</Trans>
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-primary-foreground/80 text-xs">
            <Trans>No free trials, no hidden fees. Documents are stored in Canada (AWS ca-central-1).</Trans>
          </p>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

const PlanFeature = ({ label }: { label: string }) => {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{label}</span>
    </li>
  );
};

const CheckCell = ({ label }: { label: string }) => {
  return (
    <span className="inline-flex flex-col items-center justify-center gap-1">
      <Check className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground text-xs">{label}</span>
    </span>
  );
};

const DashCell = () => {
  return (
    <span className="inline-flex items-center justify-center">
      <Minus className="h-4 w-4 text-muted-foreground/60" />
    </span>
  );
};

const TextCell = ({ children }: { children: React.ReactNode }) => {
  return <span className="inline-flex items-center justify-center">{children}</span>;
};

const ComparisonRow = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => {
  const cells = Array.isArray(children) ? children : [children];

  return (
    <tr className="border-b last:border-b-0">
      <td className="p-4">{label}</td>

      {cells.map((cell, index) => (
        <td key={index} className="p-4 text-center">
          {cell}
        </td>
      ))}
    </tr>
  );
};
