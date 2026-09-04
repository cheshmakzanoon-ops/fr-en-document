import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { NorthSignBillingDashboard } from '~/components/general/northsign-billing-dashboard';
import { SettingsHeader } from '~/components/general/settings-header';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Billing`);
}

export default function SettingsBilling() {
  const { t } = useLingui();

  return (
    <div>
      <SettingsHeader
        title={t`Billing`}
        subtitle={t`Manage the plan, usage, payment method and invoices for the organisations you own. Prices are in CAD and exclude GST/HST/QST, which are calculated at checkout.`}
        hideDivider
      />

      <NorthSignBillingDashboard />
    </div>
  );
}
