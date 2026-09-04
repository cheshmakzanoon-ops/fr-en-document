import { router } from '../trpc';
import { billingCheckoutRoute } from './checkout';
import { getBillingOverviewRoute } from './get-billing-overview';
import { billingPortalRoute } from './portal';

export const billingRouter = router({
  getBillingOverview: getBillingOverviewRoute,
  checkout: billingCheckoutRoute,
  portal: billingPortalRoute,
});
