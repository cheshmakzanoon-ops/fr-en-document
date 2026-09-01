/**
 * NorthSign — single source of truth for product branding.
 *
 * Every product-name string, email sender identity, and footer link must
 * import from this module. No product name may be hardcoded anywhere else
 * (Phase 2 rule; see BRANDING.md at the repo root).
 *
 * Upstream Documenso attribution is preserved separately (LICENSE, README,
 * footer attribution line) and must never be removed — AGPL-3.0.
 */

/** The product name shown everywhere in the UI, emails, and metadata. */
export const APP_NAME = 'NorthSign';

/** Short marketing tagline shown under the logo and in meta descriptions. */
export const APP_TAGLINE = 'Canadian-hosted e-signatures';

/** Longer marketing description used for meta descriptions and OG tags. */
export const APP_DESCRIPTION =
  'NorthSign — Canadian-hosted e-signatures for Canadian SMBs. ' +
  'PIPEDA/Law 25-friendly document signing with data residency in Canada ' +
  'and full French support for Québec.';

/** Support inbox shown in empty states, errors, and the app footer. */
export const SUPPORT_EMAIL_ADDRESS = 'support@northsign.ca';

/** Display name used as the transactional email sender (nodemailer "from" name). */
export const EMAIL_FROM_NAME = 'NorthSign';

/** Default sending address used until the Canadian sending domain is wired up in Phase 3. */
export const EMAIL_FROM_ADDRESS = 'noreply@northsign.ca';

/** Footer link set used by the app shell and email templates. */
export const FOOTER_LINKS = [
  { label: 'Website', href: 'https://northsign.ca' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Support', href: 'mailto:support@northsign.ca' },
] as const;

/**
 * Visible attribution line required in spirit by AGPL-3.0. Rendered in the
 * app footer and every email footer. Do not remove or translate away the
 * "built on Documenso" portion.
 */
export const ATTRIBUTION_LINE = 'NorthSign — built on Documenso, open source';

/** Upstream repository, linked from the attribution line and README. */
export const UPSTREAM_REPO_URL = 'https://github.com/documenso/documenso';

/**
 * NorthSign brand palette. Primary is a northern-lights teal tuned for
 * AA contrast on white (4.6:1 for text, 3:1+ for large UI); the dark
 * variant is used for text-on-primary and dark-mode surfaces.
 */
export const BRAND_COLORS = {
  primary: '#0E7C66',
  primaryDark: '#0A5C4C',
  primaryLight: '#E6F4F0',
  accent: '#D96C2C',
} as const;

export type BrandColorToken = keyof typeof BRAND_COLORS;
