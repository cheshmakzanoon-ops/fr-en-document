# DECISIONS — Technical Decision Log

> Every technical decision and its reasoning, newest last.
> This log exists so future-us (and auditors) can trace WHY the product is
> built the way it is — not just what was built.

---

## 2026-09-01 — Phase 1: Foundation decisions (fork baseline)

### D-001: Build on a Documenso fork (AGPL-3.0), not from scratch
- **Decision:** fork Documenso v2.17.0 as the product base.
- **Why:** the hard 80% (envelope model, PDF signing pipeline, auth, org/team
  model, tRPC API, admin) already exists and is battle-tested; our edge is
  Canadian hosting + bilingual EN/FR + PIPEDA/Law 25 packaging, not
  re-inventing a signing engine.
- **Consequence:** AGPL-3.0 obligations apply (source disclosure of network
  service, license/attribution preserved). Tracked in README + PHASES.md.

### D-002: `packages/ee` is COMMERCIAL-licensed — inventory now, decide in Phase 6
- **Decision:** treat `packages/ee` as off-limits for our own commercial use
  without a Documenso Enterprise subscription; do NOT rip it out in Phase 1.
- **Why:** `packages/ee/LICENSE` is a COMMERCIAL license — production use
  requires a valid Documenso Enterprise subscription. Licensed features
  (`packages/ee/FEATURES`): Stripe billing module, organisation auth portal,
  action reauth (passkeys/2FA), 21 CFR, email domains, embed authoring +
  white-label, enterprise support/SLAs. 48 files import `@documenso/ee`
  (16 in apps/remix, 21 in trpc routers) — mostly small guards plus the
  21 enterprise-router routes which are the cleanest cut line.
- **Consequence:** Phase 6 (billing) must license EE, replace those
  integration points with our own implementations, or ship without. Removal
  in Phase 1 would break envelope create/send/limits before the app has ever
  run (see D-009).

### D-003: Keep the Remix + Prisma + Postgres stack as-is
- **Decision:** no framework migration. Stack stays: TypeScript, React
  Router v7 (Remix), Hono server, Prisma ORM, Postgres, Tailwind + shadcn/ui,
  Lingui for i18n, tRPC, Biome, Playwright.
- **Why:** our differentiators (bilingual, compliance, hosting) are orthogonal
  to the web framework; a rewrite burns months for zero user value. Lingui is
  already wired — that de-risks Phase 3 (EN/FR) substantially.
- **Consequence:** we follow upstream migrations; rebase cadence needed.

### D-004: Dev environment uses docker compose for Postgres/Inbucket/MinIO
- **Decision:** use the repo's `npm run dx` flow (docker compose on 54320,
  Inbucket SMTP 2500, MinIO 9000/9002) for local dev.
- **Why:** matches upstream docs exactly; avoids local Postgres install drift.
- **Consequence:** docker must be present on the dev machine. In this sandbox
  docker is unavailable, so Phase 1 runtime verification is deferred to the
  operator's machine (checklist in handoff report).

### D-005: `.env` files are created locally, never committed
- **Decision:** create `.env`/`.env.local` from `.env.example` with dev
  defaults; real credentials are supplied by the operator, not stored in git.
- **Why:** the repo's `with:env` loader reads `.env` + `.env.local`; committing
  secrets would leak them into AGPL-published source.
- **Consequence:** operator checklist (handoff report) lists every var that
  needs a real credential: DATABASE_URL pair, SMTP creds, S3 keys, OAuth
  secrets, TURNSTILE, STRIPE keys (Phase 6).

### D-006: 10-phase plan with strict phase gating
- **Decision:** 10 phases (PHASES.md); no phase starts before the previous
  one's exit criteria are met; every decision lands in this file.
- **Why:** forces sequencing (bilingual before compliance copy; hosting before
  compliance attestation) and keeps scope discipline.
- **Consequence:** Phase 2 (rebrand) blocked on Phase 1 runtime verification.

---

## 2026-09-01 — Phase 1 runtime findings (dev environment)

### D-007: Sandbox cannot run the full stack — verification deferred, not skipped
- **Decision:** do not fake a "verified" status; document exactly what ran and
  what couldn't.
- **Why:** this sandbox has no docker daemon and no Postgres listening on
  54320/5432 (checked via `pg_isready`). The app needs a real Postgres for
  Prisma migrate/seed; without it, `npm run dev` cannot serve authenticated
  routes.
- **Consequence:** Phase 1 exit criteria "app verified + signing flow E2E"
  move to the operator's machine. Exact command sequence is in the handoff
  report (`npm run dx` → `npm run prisma:generate` →
  `npm run prisma:migrate-dev` → seed → `npm run dev`).

### D-008: Repo hygiene = main (stable) + dev (work) + decision log
- **Decision:** all work lands on `dev`; `main` tracks a known-good baseline.
  PHASES.md tracks the plan; DECISIONS.md (this file) tracks the why.
- **Why:** cheap process insurance — the fork will drift from upstream and we
  need a clean merge surface plus an auditable trail for compliance claims.
- **Consequence:** upstream syncs happen via `git fetch upstream` + merge into
  `dev`, never directly to `main`.

### D-009: EE dependency surface mapped, removal deferred to Phase 6
- **Decision:** inventory (not remove) the 48 `@documenso/ee` import sites now.
- **Why:** removal touches core flows (envelope create/use, send, limits,
  Stripe webhooks, org flows) — doing it blind in Phase 1 risks breaking the
  app before it's ever run. Phase 6 decides: license EE / replace / ship
  without. The 21 trpc enterprise-router routes are the cleanest cut line;
  the 16 apps/remix import sites are mostly small guards around billing.
- **Consequence:** Phase 6 carries an explicit "EE surface" work item with
  this list as its starting point.

### D-010: Static code health verified; lint errors are upstream, left untouched
- **Decision:** record `npm run lint` (Biome) results without editing upstream
  code: 5 errors / 842 warnings across 2177 files.
- **Why:** the only hard errors are two pre-existing upstream
  `lint/nursery/noMisusedPromises` diagnostics in
  `apps/remix/app/components/general/organisation-usage-panel.tsx:173,176` —
  nursery-rule false positives: `subtext` and `action` are typed `ReactNode`,
  not Promises, so the ternaries are safe. 842 warnings are upstream style
  noise. Editing upstream code in Phase 1 would pollute the rebrand/merge
  surface before the app has ever run.
- **Consequence:** no code changes made in Phase 1; baseline preserved. Any
  lint suppression strategy belongs to Phase 2+ alongside rebranding.

## 2026-09-01 — Phase 2: Rebranding (NorthSign)

### D-011: Branding single source of truth lives in `packages/lib/constants/brand.ts`
- **Decision:** the only place the product name/tagline/support address/email
  sender/footer links are defined is `packages/lib/constants/brand.ts`
  (`APP_NAME`, `APP_TAGLINE`, `APP_DESCRIPTION`, `SUPPORT_EMAIL_ADDRESS`,
  `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`, `FOOTER_LINKS`, `ATTRIBUTION_LINE`,
  `UPSTREAM_REPO_URL`, `BRAND_COLORS`).
- **Why:** put it in the shared `@documenso/lib` package (not
  `apps/remix/lib`) so apps/remix, packages/ui, packages/trpc, packages/signing
  and packages/email can all import it — multiple packages render brand strings.
- **Consequence:** any future rename is a one-line change; repo-wide sweep
  enforced by grepping for the old name. Env vars
  (`NEXT_PRIVATE_SMTP_FROM_*`, `NEXT_PUBLIC_SUPPORT_EMAIL`) still override
  defaults at runtime (config beats code) — see `packages/lib/constants/email.ts`
  and `app.ts`.

### D-012: Primary color = northern-lights teal `#0E7C66`, not the draft maple red
- **Decision:** shipped primary is `#0E7C66` (`hsl(168 80% 27%)`) — the
  BRANDING.md draft primary was maple red `#C8102E`; the palette was refined
  during implementation to teal. Accent `#D96C2C` (northern amber).
- **Why:** maple red reads "flag" more than "trustworthy signing product" and
  is harder to use at scale (red = destructive affordance in UIs); teal
  evokes the northern lights/Canadian north, differentiates from Documenso's
  green and DocuSign's blue, and hits AA on white (4.6:1). Dark-mode primary
  lightened to `#7DC3B1` (`documenso-300`).
- **Consequence:** CSS tokens in `packages/ui/styles/theme.css`
  (`--primary`, `--ring`, `--field-card*`), the `documenso-*` Tailwind palette
  in `packages/tailwind-config/index.cjs` (token name kept so ~40 upstream
  utility classes keep working), `DEFAULT_BRAND_COLORS` in
  `packages/lib/constants/theme.ts`, and `site.webmanifest` theme_color all
  use the teal.

### D-013: Brand assets are SVG-first; rasters regenerated pre-launch
- **Decision:** the wordmark exists as an inline SVG component
  (`apps/remix/app/components/general/branding-logo.tsx`, `currentColor`-
  aware for light/dark) plus standalone files `packages/assets/logo.svg`,
  `logo-dark.svg`, `favicon.svg`. PNG/ICO rasters (favicon.ico,
  apple-touch-icon, android-chrome-*, apps/remix/public + packages/assets
  copies, OG image, email `static/logo.png`) keep the old Documenso marks
  until regenerated from the SVGs before launch.
- **Why:** SVG is resolution-independent, diffable, and needs no binary asset
  pipeline; raster regeneration is a launch-blocking task but does not block
  development. The in-app header logo component is the same geometry as the
  standalone SVGs so there is one drawing to maintain.
- **Consequence:** deferred-list item; must ship with Phase 10 (launch).

### D-014: Attribution to Documenso is explicit and retained (AGPL-3.0 spirit)
- **Decision:** LICENSE, upstream copyright headers and attribution comments
  untouched. Added a visible footer line "NorthSign — built on Documenso,
  open source" (mobile nav + app footer), a README "Attribution" section
  linking the upstream repo, and kept the Documenso "document was sent using"
  link + the `documen.so` powered-by link in emails. `X-Documenso-*`
  webhook/email headers and the EE license UI strings stay as upstream
  protocol/license identifiers, not brand copy.
- **Why:** AGPL-3.0 requires preserving upstream notices; the wording
  documents that our product is built on Documenso and points back to it —
  honest and required.
- **Consequence:** greps for "Documenso" still hit package imports
  (`@documenso/*`), protocol headers, license-admin UI, and attribution
  lines by design; code review should not "clean these up".

### D-015: No French copy in Phase 2; strings stay i18n-extractable
- **Decision:** Phase 2 ships English copy only; Lingui `<Trans>`/`msg`/t``
  macros are used where the upstream templates already used them, so strings
  remain extractable for Phase 4's EN/FR work. Stub `/terms` and `/privacy`
  pages are marked "DRAFT — Phase 5 will finalize."
- **Why:** translating before the rebrand lands would double churn; the
  existing Lingui pipeline already covers the UI and react-email templates.
- **Consequence:** Phase 4 runs `lingui extract` on the replaced strings;
  no structural rework expected (D-004 pipeline unchanged).

### D-016: Email FROM identity stays env-overridable; prod domain in Phase 3
- **Decision:** `EMAIL_FROM_NAME = 'NorthSign'` / `EMAIL_FROM_ADDRESS =
  'noreply@northsign.ca'` are the module defaults and the
  `NEXT_PRIVATE_SMTP_FROM_NAME/ADDRESS` env vars still win when set. The
  real sending domain + DKIM/SPF land in Phase 3 (Canadian hosting);
  Inbucket keeps catching mail in dev.
- **Why:** dev mail must keep working without a real domain; the branding
  module default is the single place the sender identity is defined today.
- **Consequence:** Phase 3 change is env config + DNS, not code.
