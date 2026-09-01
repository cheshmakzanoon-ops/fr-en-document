import { APP_NAME, SUPPORT_EMAIL_ADDRESS } from '@documenso/lib/constants/brand';
import { msg } from '@lingui/core/macro';

import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Terms of Service`);
}

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <p className="font-semibold text-primary text-sm uppercase">DRAFT</p>
      <h1 className="mt-2 font-bold text-3xl">Terms of Service</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        <strong>DRAFT — Phase 5 will finalize.</strong> This page is a placeholder: the final Terms of Service
        (including PIPEDA / Law 25 compliant language) will be drafted in Phase 5 and reviewed by counsel before launch.
      </p>

      <div className="mt-8 space-y-6 text-muted-foreground text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">1. Introduction</h2>
          <p>
            Welcome to {APP_NAME}. These Terms of Service will govern your use of the {APP_NAME} electronic signature
            platform (the &ldquo;Service&rdquo;). This placeholder will be replaced with the finalized terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">2. Placeholder sections</h2>
          <p>
            Account registration, acceptable use, electronic signatures, fees, intellectual property, warranties,
            liability, termination, governing law (Quebec/Canada) and dispute resolution will be detailed here in Phase
            5.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">3. Contact</h2>
          <p>
            Questions about these terms can be sent to{' '}
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
