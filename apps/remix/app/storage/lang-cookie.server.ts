import { APP_I18N_OPTIONS, type SupportedLanguageCodes } from '@documenso/lib/constants/i18n';
import { env } from '@documenso/lib/utils/env';
import { extractLocaleData } from '@documenso/lib/utils/i18n';
import { createCookie } from 'react-router';

export const langCookie = createCookie('lang', {
  path: '/',
  maxAge: 60 * 60 * 24 * 365 * 2,
  httpOnly: true,
  secure: env('NODE_ENV') === 'production',
});

/**
 * Resolves the effective locale for a request.
 *
 * Priority: explicit `?lang=` query param (hreflang/shareable links) > `lang`
 * cookie (persisted user choice) > `Accept-Language` header > `en` fallback.
 */
export const getLocaleFromRequest = async (request: Request): Promise<SupportedLanguageCodes> => {
  const queryLang = new URL(request.url).searchParams.get('lang');

  if (queryLang && APP_I18N_OPTIONS.supportedLangs.includes(queryLang as SupportedLanguageCodes)) {
    return queryLang as SupportedLanguageCodes;
  }

  const cookieLang = await langCookie.parse(request.headers.get('cookie') ?? '');

  if (APP_I18N_OPTIONS.supportedLangs.includes(cookieLang)) {
    return cookieLang;
  }

  return extractLocaleData({ headers: request.headers }).lang;
};
