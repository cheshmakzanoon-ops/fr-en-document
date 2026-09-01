import { APP_NAME, SUPPORT_EMAIL_ADDRESS } from '@documenso/lib/constants/brand';
import { msg } from '@lingui/core/macro';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Privacy Policy`);
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <p className="font-semibold text-primary text-sm uppercase">DRAFT</p>
      <h1 className="mt-2 font-bold text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        <strong>DRAFT — Phase 5 will finalize.</strong> This page is a placeholder: the final Privacy Policy (PIPEDA /
        Law 25 compliant, including Canadian data residency commitments) will be drafted in Phase 5 and reviewed by
        counsel before launch.
      </p>

      <div className="mt-8 space-y-6 text-muted-foreground text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">1. Introduction</h2>
          <p>
            {APP_NAME} is a Canadian-hosted electronic signature service. This placeholder Privacy Policy will be
            replaced with the finalized policy describing what personal information we collect, why, and how it is
            protected.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">2. Placeholder sections</h2>
          <p>
            Data collected, legal bases, data residency (Canada), retention, third-party processors, your rights under
            PIPEDA and Quebec Law 25, and contact information will be detailed here in Phase 5.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">3. Contact</h2>
          <p>
            Privacy questions can be sent to{' '}
            <a href={`mailto:${SUPPORT_EMAIL_ADDRESS}`} className="text-primary underline underline-offset-2">
              {SUPPORT_EMAIL_ADDRESS}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
