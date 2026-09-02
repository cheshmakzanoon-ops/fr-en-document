import { useSession } from '@documenso/lib/client-only/providers/session';
import { isPersonalLayout } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Button } from '@documenso/ui/primitives/button';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AnimatePresence } from 'framer-motion';

import { AccountDeleteDialog } from '~/components/dialogs/account-delete-dialog';
import { AvatarImageForm } from '~/components/forms/avatar-image';
import { ProfileForm } from '~/components/forms/profile';
import { SettingsHeader } from '~/components/general/settings-header';
import { TeamEmailUsage } from '~/components/general/teams/team-email-usage';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Profile`);
}

export default function SettingsProfile() {
  const { _ } = useLingui();
  const { organisations, user } = useSession();

  const { data: teamEmail } = trpc.team.email.get.useQuery();

  const isPersonalLayoutMode = isPersonalLayout(organisations);

  return (
    <div>
      <SettingsHeader title={_(msg`Profile`)} subtitle={_(msg`Here you can edit your personal details.`)} />

      <AvatarImageForm className="mb-8 max-w-xl" />
      <ProfileForm className="mb-8 max-w-xl" />

      <div className="max-w-xl space-y-8">
        <AnimatePresence>
          {(!isPersonalLayoutMode || user.email !== teamEmail?.email) && teamEmail && (
            <AnimateGenericFadeInOut>
              <TeamEmailUsage teamEmail={teamEmail} />
            </AnimateGenericFadeInOut>
          )}
        </AnimatePresence>

        <AccountDeleteDialog />
      </div>

      <div className="mt-8 max-w-xl rounded-lg border p-4">
        <h3 className="font-semibold text-sm">
          <Trans>Export your data</Trans>
        </h3>
        <p className="mt-1 text-muted-foreground text-xs">
          <Trans>
            Download a machine-readable copy of the personal information we hold about you — your profile, consent
            records, security log, and the documents you own (metadata and recipients). PDF files themselves can be
            downloaded from the documents page.
          </Trans>
        </p>
        <Button asChild className="mt-3" size="sm" variant="outline">
          <a href="/settings/export-data" download>
            <Trans>Download data export</Trans>
          </a>
        </Button>
      </div>
    </div>
  );
}
