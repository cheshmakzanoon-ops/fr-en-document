import { useOptionalCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION, SKIP_QUERY_BATCH_META } from '@documenso/lib/constants/trpc';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router';

/**
 * NorthSign billing banner (Phase 6, D-035). Two signals only — payment
 * problems on a managed subscription, and the free Starter allowance being
 * at/near its cap. Every other plan state is silent; the old claim-based
 * banners above stay responsible for non-managed (provider-null) rows.
 */
export const NorthSignBillingBanner = () => {
  const { t } = useLingui();

  const organisation = useOptionalCurrentOrganisation();

  const { data: overview } = trpc.billing.getBillingOverview.useQuery(undefined, {
    enabled: Boolean(organisation),
    ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    ...SKIP_QUERY_BATCH_META,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  if (!organisation) {
    return null;
  }

  const entry = overview?.find((candidate) => candidate.organisationId === organisation.id);

  if (!entry) {
    return null;
  }

  const isPaymentFailed = Boolean(entry.provider) && (Boolean(entry.paymentFailedAt) || entry.status === 'PAST_DUE');

  if (isPaymentFailed) {
    return (
      <div className="bg-destructive text-destructive-foreground">
        <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 font-medium text-sm">
          <span className="flex items-center">
            <AlertTriangle className="mr-2.5 h-5 w-5" />
            <Trans>Payment failed — update your payment method to keep your plan active.</Trans>
          </span>

          <Button asChild variant="outline" size="sm" className="text-destructive-foreground hover:text-destructive">
            <Link to="/settings/billing">
              <Trans>Update payment method</Trans>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const limit = entry.documentsPerPeriod;
  const used = entry.sentThisPeriod;

  const showUsageBanner =
    !entry.isPaid && limit !== null && used > 0 && (entry.hasReachedLimit || entry.isNearingLimit);

  if (!showUsageBanner) {
    return null;
  }

  return (
    <div className="bg-yellow-200 text-yellow-900 dark:bg-yellow-400 dark:text-yellow-950">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 font-medium text-sm">
        <span className="flex items-center">
          <AlertTriangle className="mr-2.5 h-5 w-5" />

          {entry.hasReachedLimit
            ? t`You have used all ${limit} free documents this month.`
            : t`You have used ${used} of ${limit} free documents this month.`}
        </span>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-yellow-700/40 bg-background/60 hover:bg-background"
        >
          <Link to="/pricing">
            <Trans>Upgrade to send more</Trans>
          </Link>
        </Button>
      </div>
    </div>
  );
};
