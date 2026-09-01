# BRANDING — NorthSign

## Baseline

- **Product name:** NorthSign
- **Tagline:** Canadian-hosted e-signatures.
- **Positioning:** Canadian-hosted, bilingual (EN/FR) e-signature SaaS for Canadian SMBs.
- **Trademark note:** a CIPO (Canadian Intellectual Property Office) trademark
  clearance check MUST be completed before public launch. The name is a working
  title until that check passes.

## Colors

| Role | Hex | Notes |
|------|-----|-------|
| Primary | `#C8102E` | Maple red; approx `hsl(350, 85%, 42%)`. ≥4.5:1 on white. |
| Secondary | `#212B36` | Dark slate for text/surfaces. |
| Accent | `#F2A900` | Amber for highlights/badges; decorative only (low contrast on white). |

Primary-foreground (text on primary buttons): `#FFFFFF`.
Dark-mode primary: `#E4405C` (lightened for contrast on dark surfaces).

## Logo variants

- `logo.svg` — horizontal wordmark + maple-leaf mark (light backgrounds).
- `logo-dark.svg` — same mark, light text (dark backgrounds).
- `favicon.svg` — maple-leaf mark only.
- PNG/ICO rasters (favicon.ico, apple-touch-icon, android-chrome, opengraph
  JPG) must be regenerated from the SVGs before launch — see deferred list.

---

## Appendix — Brand Asset Map (Phase 2, Step 1)

Every location where the brand (name, colors, logo) appears in the fork.
"Refactor" = what Step 2 does to it.

### Name constants & env defaults (single-source targets)

| Path | What |
|------|------|
| `packages/lib/constants/app.ts` | `SUPPORT_EMAIL` default `support@documenso.com`; `IS_DOCUMENSO_CLOUD` flag (upstream env name — kept) |
| `packages/lib/constants/email.ts` | `FROM_NAME` default `'Documenso'`, `FROM_ADDRESS` default `noreply@documenso.com`, `DOCUMENSO_INTERNAL_EMAIL` |
| `packages/lib/constants/auth.ts` | `DOCUMENSO: 'Documenso'` (provider label constant) |
| `packages/lib/server-only/email/get-email-context.ts` | resolves `fromName` from DB transports (no literal) |

### Web app (apps/remix)

| Path | What |
|------|------|
| `apps/remix/app/utils/meta.ts` | page titles `- Documenso`, meta description, keywords, author `Documenso, Inc.`, og/twitter strings, og image path |
| `apps/remix/app/root.tsx` | favicon/apple-touch-icon links (public/), expired-license banner `<Trans>` |
| `apps/remix/app/components/general/app-nav-mobile.tsx` | logo img (`@documenso/assets/logo.png`), alt `Documenso Logo`, footer `© … Documenso, Inc.` |
| `apps/remix/app/routes/_profile+/_layout.tsx` | logo img (`logo_icon.png`), alt `Documenso Logo` |
| `apps/remix/app/routes/_recipient+/_layout.tsx` | title `Sign Document - Documenso` |
| `apps/remix/app/routes/_share+/share.$slug.tsx` | title/description/og/twitter `Documenso` strings |
| `apps/remix/app/routes/_unauthenticated+/o.$orgUrl.signin.tsx` | `Return to Documenso sign in page here` |
| `apps/remix/app/routes/_unauthenticated+/organisation.invite.$token.tsx` | `…on Documenso` invite copy |
| `apps/remix/app/routes/_unauthenticated+/verify-email.$token.tsx` | `…features of Documenso` (×2) |
| `apps/remix/app/routes/_unauthenticated+/articles.signature-disclosure.tsx` | ESIGN disclosure copy (×2) |
| `apps/remix/app/routes/_recipient+/sign.$token+/_index.tsx` | `Check out Documenso` (×2) |
| `apps/remix/app/routes/_profile+/p.$url.tsx` | `create your own Documenso account` |
| `apps/remix/app/routes/_authenticated+/o.$orgUrl.support.tsx` | `get started with Documenso` |
| `apps/remix/app/components/dialogs/token-create-dialog.tsx` | `the Documenso API` |
| `apps/remix/app/components/dialogs/webhook-create-dialog.tsx` / `webhook-edit-dialog.tsx` | `The URL for Documenso to send webhook events` (×2 each) |
| `apps/remix/app/components/dialogs/account-delete-dialog.tsx` | `Documenso will delete all of your documents` |
| `apps/remix/app/components/dialogs/envelope-distribute-dialog.tsx` | sender `<SelectItem>Documenso` |
| `apps/remix/app/components/general/envelope-editor/envelope-editor-settings-dialog.tsx` | sender `<SelectItem>Documenso` |
| `apps/remix/app/components/general/document/document-certificate-qr-view.tsx` | `your Documenso account` |
| `apps/remix/app/components/general/admin-license-status-banner.tsx` | `Your Documenso instance…` (×2) |
| `apps/remix/app/components/general/admin-license-card.tsx` | `Documenso License` |
| `apps/remix/app/components/general/settings-upsell/branding-upsell.tsx` | `name: 'Documenso'` (×3) |
| `apps/remix/app/components/general/settings-upsell/email-domains-upsell.tsx` | unbranded-state copy |
| `apps/remix/app/components/general/organisations/organisation-billing-banner.tsx` | plan copy |
| `apps/remix/app/components/embed/embed-document-completed.tsx` | `name \|\| 'Documenso'` fallback |
| `apps/remix/app/components/general/background.tsx` | hardcoded upstream gradient colors `#79B9A7`/`#B6D2C4` (visual only) |

### Shared packages

| Path | What |
|------|------|
| `packages/ui/primitives/document-flow/add-subject.tsx` | sender `<SelectItem>Documenso` |
| `packages/ui/primitives/template-flow/add-template-settings.tsx` | sender `<SelectItem>Documenso` |
| `packages/signing/index.ts` | PDF signature reason `'Signed by Documenso'` |
| `packages/api/v1/openapi.ts` | `title: 'Documenso API'` + deprecation text |
| `packages/trpc/server/open-api.ts` | `title: 'Documenso v2 API'` + description |
| `packages/lib/utils/email-branding-colors.ts` | default email branding colors |
| `packages/lib/server-only/pdf/render-audit-logs.ts`, `render-certificate.ts` | certificate logo `public/static/logo.png` |

### Email (packages/email)

| Path | What |
|------|------|
| `packages/email/template-components/template-footer.tsx` | `Documenso` link, `Documenso, Inc.` + SF address fallback |
| `packages/email/template-components/template-branding-logo.tsx` | default logo `/static/logo.png`, alt `Documenso Logo` |
| `packages/email/template-components/template-confirmation-email.tsx` | `Welcome to Documenso!` |
| `packages/email/template-components/template-admin-user-created.tsx` | `Welcome to Documenso!`, `a Documenso account` |
| `packages/email/templates/admin-user-created.tsx` | logo img alt `Documenso Logo` |
| `packages/email/templates/organisation-*.tsx`, `team-email-removed.tsx`, `confirm-team-email.tsx` | preview text `…on Documenso` (6 templates) |
| `packages/email/preview/app/lib/templates.tsx` | preview defaults `'Documenso'` (×9, dev-only) |

### Design tokens

| Path | What |
|------|------|
| `packages/tailwind-config/index.cjs` | `documenso` color palette `#A2E771…` (used as Tailwind classes `documenso-*` across the app) |
| `packages/ui/styles/theme.css` | `--primary: 95.08 71.08% 67.45%` (green HSL) + `--ring`, `--field-card*`, dark variants |

### Static assets

| Path | What |
|------|------|
| `packages/assets/logo.png`, `logo_icon.png` | app logo (imported by remix) |
| `packages/assets/favicon*.png`, `favicon.ico`, `apple-touch-icon.png`, `android-chrome-*.png`, `site.webmanifest` | favicons |
| `packages/assets/opengraph-image.jpg` | OG image |
| `apps/remix/public/**` (same set) | served copies |
| `apps/remix/public/static/logo.png` | email/certificate logo |

### Env vars carrying brand defaults (config, not code)

`NEXT_PRIVATE_SMTP_FROM_NAME` / `NEXT_PRIVATE_SMTP_FROM_ADDRESS` /
`NEXT_PUBLIC_SUPPORT_EMAIL` override the branding-module defaults at runtime.
