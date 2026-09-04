/**
 * NorthSign prices are whole CAD dollars on every plan (Phase 6, D-031).
 * Rendered locale-aware: fr-CA gets comma decimals + the "$ CA" convention,
 * everything else uses the en-CA style. Prices are always shown exclusive of
 * tax — GST/HST/QST are only ever added by Stripe Tax at checkout.
 */
export const formatCadPrice = (cents: number, locale = 'en-CA'): string => {
  const dollars = cents / 100;

  const isWhole = Number.isInteger(dollars);

  return new Intl.NumberFormat(locale === 'fr-CA' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
};
