import { PRIVACY_VERSION } from '@documenso/lib/constants/brand';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { getLocaleFromRequest } from '~/storage/lang-cookie.server';
import { DRAFT_BANNER_EN, DRAFT_BANNER_FR, type LegalContent, PRIVACY_EN, PRIVACY_FR } from '~/utils/legal-content';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/privacy';

export function meta() {
  return appMetaTags(msg`Privacy Policy`);
}

const CONTENT: Record<'en' | 'fr', LegalContent> = {
  en: PRIVACY_EN,
  fr: PRIVACY_FR,
};

export async function loader({ request }: Route.LoaderArgs) {
  // The same request-level resolution the root loader uses (?lang= > cookie >
  // Accept-Language > en), so /privacy?lang=fr renders French server-side
  // without relying on client state.
  const locale = await getLocaleFromRequest(request);

  return { lang: locale.startsWith('fr') ? ('fr' as const) : ('en' as const) };
}

export default function PrivacyPage({ loaderData }: Route.ComponentProps) {
  const { lang } = loaderData;
  const content = CONTENT[lang];
  const draftBanner = lang === 'fr' ? DRAFT_BANNER_FR : DRAFT_BANNER_EN;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 dark:border-amber-400 dark:bg-amber-950">
        <p className="font-semibold text-amber-700 text-sm dark:text-amber-300">⚠️ {draftBanner}</p>
      </div>

      <h1 className="mt-8 font-bold text-3xl">{content.title}</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>Last updated</Trans>: {content.lastUpdated} · v{content.version}
      </p>

      <div className="mt-8 space-y-6 text-muted-foreground text-sm leading-relaxed">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-2 font-semibold text-base text-foreground">{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index} className={index > 0 ? 'mt-3' : undefined}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section>
          <h2 className="mb-2 font-semibold text-base text-foreground">
            <Trans>Version</Trans>
          </h2>
          <p>
            <Trans>Privacy Policy version</Trans>: {PRIVACY_VERSION}
          </p>
        </section>
      </div>
    </main>
  );
}
