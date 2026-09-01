# PHASES — Canadian Bilingual Document-Signing SaaS

> Fork of Documenso (https://github.com/documenso/documenso, AGPL-3.0).
> Goal: a Canadian-hosted, bilingual (EN/FR) document-signing SaaS for Canadian
> SMBs, positioned as a PIPEDA/Law 25-compliant DocuSign alternative.
>
> **Attribution:** this is a fork of Documenso under AGPL-3.0. Their license
> and attribution are preserved in full — see `LICENSE` and `README.md`.

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Foundation audit & dev environment | **complete** |
| 2 | Rebranding (name, logo, colors, app copy) | **complete** |
| 3 | Bilingual i18n (EN/FR) with Lingui | pending |
| 4 | Canadian hosting & data residency | pending |
| 5 | PIPEDA / Law 25 compliance workstream | pending |
| 6 | Billing & plans (SMB pricing tiers) | pending |
| 7 | Admin, audit trail & reporting | pending |
| 8 | Onboarding, templates & integrations | pending |
| 9 | Hardening, load & security testing | pending |
| 10 | Launch (beta → GA), docs & support | pending |

## Phase 1 — Foundation audit & dev environment (complete)

1. **Audit the codebase** — tech stack, ORM, auth, file storage, email, where
   each is configured, plus repo structure and branding-asset locations.
2. **Get the app running** — env files from `.env.example`, dependencies,
   database migrate + seed, dev server, verify the core signing flow.
3. **Repo hygiene** — `main` (stable) / `dev` (active work) branches,
   `PHASES.md`, `DECISIONS.md`, README vision + fork attribution notice.
4. **Handoff report** — stack overview, failures, credentials checklist,
   exact restart commands.

### Status detail

- [x] Codebase audit (stack, config locations, structure map)
- [x] LICENSE confirmed AGPL-3.0; `packages/ee` audited = COMMERCIAL license
  (production use requires a Documenso Enterprise subscription). 48 files
  import `@documenso/ee` — Phase 6 must license, replace, or ship without
  (D-002/D-009 in `DECISIONS.md`)
- [x] Repo hygiene files created (`PHASES.md`, `DECISIONS.md`, README notice)
- [x] Env files created from `.env.example` with dev defaults
- [x] Dependencies installed
- [x] Static code health verified: `npm run lint` (Biome) reports 5 errors /
  842 warnings across 2177 files. The only hard errors are two pre-existing
  upstream `lint/nursery/noMisusedPromises` diagnostics in
  `apps/remix/app/components/general/organisation-usage-panel.tsx:173,176`
  (nursery rule false positives on `subtext`/`action` ternaries — both values
  are `ReactNode`, not Promises). 842 warnings are upstream style noise.
  No code changes made; upstream code preserved as-is.
- [ ] Database migrated + seeded *(blocked in sandbox: no docker daemon, no
  Postgres on 54320/5432 — operator runs `npm run dx` on their machine, see
  handoff report)*
- [ ] App verified in dev mode *(same sandbox limitation)*
- [ ] Core signing flow verified end-to-end *(same sandbox limitation)*
- [x] Handoff report delivered (see session log + `DECISIONS.md`)

**Sandbox limitation (re-verified this session):** `docker info` fails
(unavailable) and `pg_isready -p 54320` reports no response, so migrate/seed/
dev-server/E2E verification must run on the operator's machine. Not skipped —
deferred with exact steps.

**Additional Phase 1 finding (license audit):** `packages/ee` carries a
**COMMERCIAL** license (production use requires a Documenso Enterprise
subscription). Licensed features (`packages/ee/FEATURES`): Stripe billing
module, organisation auth portal, action reauth (passkeys/2FA), 21 CFR, email
domains, embed authoring + white-label, enterprise support/SLAs. **48 files**
import `@documenso/ee` (16 in apps/remix, 21 in trpc routers — mostly the
enterprise-router block, plus 16 small guards in the app). Phase 6 must decide:
license EE, replace those integration points, or ship without them. Removal in
Phase 1 would break envelope create/send/limits before the app has ever run.

## Phase 2 — Rebranding: NorthSign (complete)

Working name **NorthSign** — *"Canadian-hosted e-signatures."* CIPO trademark
check still pending before any public launch (see `BRANDING.md`).

1. **Brand baseline + asset map** — `BRANDING.md` with name, tagline, palette,
   logo variants, and the appendix map of every brand touchpoint in the repo
   (commits `60ed3f5`).
2. **Single source of truth** — `packages/lib/constants/brand.ts` exports
   `APP_NAME`, `APP_TAGLINE`, `APP_DESCRIPTION`, `SUPPORT_EMAIL_ADDRESS`,
   `EMAIL_FROM_NAME/ADDRESS`, `FOOTER_LINKS`, `ATTRIBUTION_LINE`,
   `UPSTREAM_REPO_URL`, `BRAND_COLORS` (D-011). All product-name strings in
   apps/remix, packages/ui, packages/lib, packages/trpc, packages/email now
   import from it (commits `f36c677`, `91055f1`).
3. **Visual identity** — inline `BrandingLogo` wordmark SVG +
   `packages/assets/logo.svg|logo-dark.svg|favicon.svg`; Tailwind theme
   primary retuned to NorthSign teal `#0E7C66` (theme.css + tailwind-config
   `documenso-*` palette remap + theme.ts `DEFAULT_BRAND_COLORS` + manifest +
   auth-background gradient) (commits `f36c677`, `e65beaa`; choice in D-012;
   approach in D-013).
4. **Email templates** — every react-email template: FROM name/address,
   logo alt text, welcome/join/confirm copy, footer placeholder
   (`NorthSign, Inc. — Canada`); the Documenso "powered by" link on document
   emails is intentionally kept (AGPL attribution, see Step 4 note in
   `BRANDING.md`). Real sending domain lands in Phase 3; Inbucket still
   catches mail in dev (commits `16cdfcf`, `91055f1`).
5. **Copy & metadata** — page titles/meta (meta.ts, share route, recipient
   layout), auth/verify/invite screens, empty states, sender SelectItems,
   PDF signature reason, OpenAPI titles, stub `/terms` and `/privacy` pages
   marked "DRAFT — Phase 5 will finalize" (commits `837cb34`, `91055f1`,
   `e65beaa`). No French translation yet — Phase 4; strings stay Lingui-
   extractable (`<Trans>` / t`` macro where practical).
6. **Attribution** — README "Attribution" section + UI footer line
   "NorthSign — built on Documenso, open source" + email footer link kept
   (commits `e894d77`, `f36c677`).
7. **Verification** — `npm run lint` (Biome) still reports the unmodified
   Phase-1 baseline of **5 errors / 842 warnings** (no new diagnostics);
   `tsc --noEmit` on `packages/lib` and `packages/email` shows no errors in
   any file touched by this phase (remaining lib errors are pre-existing
   Prisma model drift in untouched files). Full runtime click-through
   (sign-up → upload → add recipient → send + Inbucket check) is listed in
   the handoff for the operator's machine (sandbox has no docker/Postgres).
8. **Deferred to later phases** — PNG/ICO/OG raster regeneration from the
   SVGs (pre-launch), `packages/ee` white-label/branding decisions (Phase 6),
   `NEXT_PUBLIC_*` env defaults for the production domain (Phase 3),
   signature-disclosure legal text finalization (Phase 5).
