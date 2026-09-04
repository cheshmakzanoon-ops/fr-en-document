import { type BillingInterval, priceForPlan } from '@documenso/lib/server-only/billing/plans';
import { trpc } from '@documenso/trpc/react';
import type { TGetBillingOverviewResponse } from '@documenso/trpc/server/billing-router/get-billing-overview.types';
import { cn } from '@documenso/ui/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Progress } from '@documenso/ui/primitives/progress';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { BillingPlanType, BillingProvider } from '@prisma/client';
import { AlertTriangle, ArrowUpRight, CheckCircle2, CreditCard, FileText, InfoIcon, Receipt } from 'lucide-react';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { formatCadPrice } from '~/utils/format-cad';

const PLAN_LABEL: Record<BillingPlanType, MessageDescriptor> = {
  [BillingPlanType.STARTER]: msg`Starter`,
  [BillingPlanType.PRO]: msg`Pro`,
  [BillingPlanType.BUSINESS]: msg`Business`,
};

const UPGRADE_PLAN = BillingPlanType.PRO;

export const NorthSignBillingDashboard = () => {
  const { i18n, t } = useLingui();
  const { toast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();

  const [pendingAction, setPendingAction] = useState<{ organisationId: string; kind: 'checkout' | 'portal' } | null>(
    null,
  );

  const { data: overview, isPending } = trpc.billing.getBillingOverview.useQuery(undefined);

  const checkoutMutation = trpc.billing.checkout.useMutation();
  const portalMutation = trpc.billing.portal.useMutation();

  const upgradedParam = searchParams.get('upgraded');
  const checkoutStatus = searchParams.get('checkout');
  const portalFlag = searchParams.get('mock_portal');

  // Feedback flags from the mock/stripe checkout round-trip: show once, then
  // strip the query params so a refresh does not re-toast.
  const feedback = useMemo(() => {
    if (upgradedParam) {
      return {
        variant: 'default' as const,
        title: t(msg`Welcome to your new plan`),
        description: t(msg`Your plan has been updated. You can start sending without limits right away.`),
      };
    }

    if (checkoutStatus === 'success') {
      return {
        variant: 'default' as const,
        title: t(msg`Checkout complete`),
        description: t(msg`Your subscription is being activated — this usually takes a few seconds.`),
      };
    }

    if (checkoutStatus === 'canceled') {
      return {
        variant: 'neutral' as const,
        title: t(msg`Checkout cancelled`),
        description: t(msg`No changes were made to your plan. You can upgrade whenever you are ready.`),
      };
    }

    if (portalFlag === '1') {
      return {
        variant: 'secondary' as const,
        title: t(msg`Billing portal is simulated`),
        description: t(
          msg`NorthSign is running with the test billing provider, so there is no real Stripe portal. In production this button opens your payment method, invoices, and plan changes.`,
        ),
      };
    }

    return null;
  }, [upgradedParam, checkoutStatus, portalFlag, t]);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const clean = new URLSearchParams(searchParams);

    clean.delete('upgraded');
    clean.delete('checkout');
    clean.delete('mock_portal');

    setSearchParams(clean, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const handleUpgrade = async (organisationId: string, interval: BillingInterval) => {
    setPendingAction({ organisationId, kind: 'checkout' });

    try {
      const { url } = await checkoutMutation.mutateAsync({
        organisationId,
        plan: UPGRADE_PLAN,
        interval,
        returnPath: '/settings/billing',
      });

      window.location.assign(url);
    } catch {
      setPendingAction(null);

      toast({
        title: t(msg`Something went wrong`),
        description: t(msg`We were unable to start the checkout. Please try again, or contact support.`),
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  const handleManageBilling = async (organisationId: string) => {
    setPendingAction({ organisationId, kind: 'portal' });

    try {
      const { url } = await portalMutation.mutateAsync({ organisationId });

      window.location.assign(url);
    } catch {
      setPendingAction(null);

      toast({
        title: t(msg`Something went wrong`),
        description: t(msg`We were unable to open the billing portal. Please try again, or contact support.`),
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  if (isPending) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-64 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    );
  }

  if (!overview || overview.length === 0) {
    return (
      <Alert variant="neutral">
        <InfoIcon />
        <AlertTitle>
          <Trans>No billing organisations found</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>
            Billing is managed per organisation. Create an organisation to get started, or contact support if you
            believe this is a mistake.
          </Trans>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <Alert variant={feedback.variant}>
          {feedback.variant === 'default' ? <CheckCircle2 /> : <InfoIcon />}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {overview.map((entry) => (
          <OrganisationBillingCard
            key={entry.organisationId}
            entry={entry}
            pendingAction={pendingAction}
            onUpgrade={(interval) => void handleUpgrade(entry.organisationId, interval)}
            onManageBilling={() => void handleManageBilling(entry.organisationId)}
            formatDate={(date) => i18n.date(date, DateTime.DATE_MED)}
            formatPrice={(cents) => formatCadPrice(cents, i18n.locale ?? 'en-CA')}
          />
        ))}
      </div>
    </div>
  );
};

type OrganisationBillingCardProps = {
  entry: TGetBillingOverviewResponse[number];
  pendingAction: { organisationId: string; kind: 'checkout' | 'portal' } | null;
  onUpgrade: (interval: BillingInterval) => void;
  onManageBilling: () => void;
  formatDate: (date: Date) => string;
  formatPrice: (cents: number) => string;
};

const OrganisationBillingCard = ({
  entry,
  pendingAction,
  onUpgrade,
  onManageBilling,
  formatDate,
  formatPrice,
}: OrganisationBillingCardProps) => {
  const { t } = useLingui();

  const periodLimit = entry.documentsPerPeriod;
  const sentCount = entry.sentThisPeriod;
  const periodEndDate = entry.periodEnd ? formatDate(entry.periodEnd) : null;
  const proMonthlyPrice = formatPrice(priceForPlan(UPGRADE_PLAN, 'monthly'));

  const isBusy =
    pendingAction?.organisationId === entry.organisationId &&
    (pendingAction.kind === 'checkout' || pendingAction.kind === 'portal');
  const isCheckoutBusy = pendingAction?.organisationId === entry.organisationId && pendingAction.kind === 'checkout';
  const isPortalBusy = pendingAction?.organisationId === entry.organisationId && pendingAction.kind === 'portal';

  const isPaymentFailed = Boolean(entry.paymentFailedAt) || entry.status === 'PAST_DUE';

  const usagePercent = useMemo(() => {
    if (entry.documentsPerPeriod === null || entry.documentsPerPeriod === 0) {
      return null;
    }

    return Math.min(Math.round((entry.sentThisPeriod / entry.documentsPerPeriod) * 100), 100);
  }, [entry.documentsPerPeriod, entry.sentThisPeriod]);

  return (
    <div className="flex flex-col rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{entry.organisationName}</h3>

          <div className="mt-1 flex items-center gap-2">
            <Badge variant={entry.isPaid ? 'default' : 'neutral'}>{t(PLAN_LABEL[entry.plan])}</Badge>

            {entry.provider === BillingProvider.MOCK && (
              <Badge variant="secondary">
                <Trans>Test mode</Trans>
              </Badge>
            )}
          </div>
        </div>

        {entry.isPaid ? (
          <Badge variant="neutral" className="text-muted-foreground">
            {entry.cancelAtPeriodEnd ? <Trans>Cancels at period end</Trans> : <Trans>Active</Trans>}
          </Badge>
        ) : (
          <Badge variant="neutral" className="text-muted-foreground">
            <Trans>Free plan</Trans>
          </Badge>
        )}
      </div>

      {isPaymentFailed && (
        <Alert variant="warning" className="mt-4">
          <AlertTriangle />
          <AlertTitle>
            <Trans>Payment failed</Trans>
          </AlertTitle>
          <AlertDescription>
            <Trans>
              We could not charge your payment method. Your access continues until the end of the billing period, then
              the plan is paused. Update your payment method to avoid an interruption.
            </Trans>
          </AlertDescription>
        </Alert>
      )}

      {/* Usage this period */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            <Trans>Usage this period</Trans>
          </span>

          {periodLimit !== null && (
            <span className="text-muted-foreground">{t`${sentCount} of ${periodLimit} documents sent`}</span>
          )}
        </div>{' '}
        {usagePercent !== null ? (
          <>
            <Progress value={usagePercent} className="mt-2" />

            <p className="mt-2 text-muted-foreground text-xs">
              {entry.hasReachedLimit
                ? t`You have reached the ${periodLimit} documents per month limit.`
                : entry.isNearingLimit
                  ? t`You have 1 document left this period.`
                  : periodEndDate
                    ? t`Current period ends ${periodEndDate}.`
                    : t`Resets at the start of each calendar month.`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-muted-foreground text-sm">
            {periodEndDate ? t`Current period ends ${periodEndDate}.` : t`Unlimited documents sent.`}
          </p>
        )}
      </div>

      {/* Plan limits snapshot */}
      <ul className="mt-4 flex flex-col gap-1.5 border-t pt-4 text-sm">
        <LimitRow
          icon={<FileText className="h-4 w-4" />}
          label={t`Recipients per document`}
          value={entry.recipientsPerDocument === null ? t`Unlimited` : String(entry.recipientsPerDocument)}
        />
        <LimitRow
          icon={<Receipt className="h-4 w-4" />}
          label={t`Templates`}
          value={entry.allowsTemplates ? t`Included` : t`Not included`}
        />
        <LimitRow
          icon={<CreditCard className="h-4 w-4" />}
          label={t`API access`}
          value={entry.allowsApi ? t`Included` : t`Not included`}
        />
      </ul>

      {/* CTA row */}
      <div className="mt-6 flex flex-col gap-2 border-t pt-4">
        {entry.isPaid ? (
          <>
            <Button loading={isPortalBusy || isBusy} onClick={onManageBilling} className="w-full">
              <Trans>Manage billing</Trans>
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>

            {periodEndDate && (
              <p className="text-center text-muted-foreground text-xs">
                {entry.cancelAtPeriodEnd ? t`Subscription ends ${periodEndDate}.` : t`Renews ${periodEndDate}.`}
              </p>
            )}

            {entry.provider === BillingProvider.MOCK && (
              <p className="text-center text-muted-foreground text-xs">
                <Trans>Invoices and payment methods live in the billing portal.</Trans>
              </p>
            )}
          </>
        ) : (
          <>
            <Button loading={isCheckoutBusy || isBusy} onClick={() => onUpgrade('monthly')} className="w-full">
              {t`Upgrade to Pro — ${proMonthlyPrice}/month`}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to="/pricing">
                <Trans>Compare plans and annual pricing</Trans>
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const LimitRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => {
  return (
    <li className={cn('flex items-center justify-between gap-3 text-muted-foreground')}>
      <span className="flex items-center gap-2">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </li>
  );
};
