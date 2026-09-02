import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, UPSTREAM_REPO_URL } from '@documenso/lib/constants/brand';
import { i18n, type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

export const appMetaTags = (title?: MessageDescriptor) => {
  // Phase 4: meta copy routes through the i18n layer. The marketing constants
  // are interpolated as ICU variables so each locale can supply its own copy
  // (fr-CA in the catalog); en output is unchanged from before.
  const description = i18n._(
    msg`${APP_DESCRIPTION} ${APP_TAGLINE}. Built on ${UPSTREAM_REPO_URL.replace('https://', '')}.`,
  );

  const keywords = i18n._(
    msg`${APP_NAME}, Canadian-hosted e-signatures, DocuSign alternative, document signing, PIPEDA, Law 25, bilingual EN/FR, data residency Canada, open source`,
  );

  const tagline = i18n._(msg`Canadian-hosted e-signatures`);

  return [
    {
      title: title ? `${i18n._(title)} - ${APP_NAME}` : APP_NAME,
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content: keywords,
    },
    {
      name: 'author',
      content: `${APP_NAME}, Inc.`,
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: `${APP_NAME} - ${tagline}`,
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: '@documenso',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
