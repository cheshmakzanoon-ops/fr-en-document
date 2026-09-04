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
- **Consequence:** Phase 3 change is env config + DNS, not code. Delivered
  in Phase 3 (see D-019, D-020).

---

## 2026-09-01 — Phase 3: Canadian hosting & production infrastructure

> Phase numbering reorder: Canadian hosting is now Phase 3 (before
> bilingual i18n, which moves to Phase 4). Entries D-015 and earlier predate
> the reorder.

### D-017: Region pinning is an architecture rule, not a preference
- **Decision:** every runtime component must be hostable in AWS
  ca-central-1 (Montreal). Any dependency without a Canadian region is
  flagged and swapped before it enters production. Documented in
  `DEPLOYMENT.md` ("the architecture rule").
- **Why:** the data-residency claim is the product's core differentiator
  and the marketing/legal language depends on it ("data at rest and
  document processing occur in AWS ca-central-1, Montreal"). PIPEDA and
  Law 25 buyers explicitly shop this property; a single non-Canadian
  runtime dependency (e.g. a US-only analytics SDK or queue) would make
  the claim false.
- **Consequence:** every Phase 3 choice below was screened against this
  rule (S3, SES, Postgres, Caddy, monitoring). Future phases must do the
  same; the rule is stated verbatim in DEPLOYMENT.md.

### D-018: PostgreSQL on the VM, not RDS (for now)
- **Decision:** Postgres 16 runs as a container on the same VM as the app
  (`docker-compose.prod.yml`), with nightly `pg_dump` custom-format
  backups to S3. No RDS.
- **Why:** the MVP is a single small workload on one VM; an on-VM Postgres
  is region-pinned to ca-central-1 by construction (the EBS volume is
  there), costs nothing extra, and `pg_dump`/`pg_restore` backup and
  restore are simple and already drilled (RESTORE.md). RDS in ca-central-1
  would add managed failover/PITR but also minimum-instance cost and
  another moving part — no residency advantage (both are ca-central-1).
- **Consequence:** revisit RDS (or a managed Postgres) in Phase 9 when
  availability/point-in-time-recovery requirements are concrete; the
  backup/restore contract (custom-format dumps in S3) carries over either
  way.

### D-019: SES over Postmark (region rule decides it)
- **Decision:** transactional email uses AWS SES in ca-central-1 via the
  SMTP interface (host `email-smtp.ca-central-1.amazonaws.com:587`,
  STARTTLS), sender `no-reply@mail.northsign.ca`. No third-party email
  API.
- **Why:** Postmark (the main alternative) has no Canadian region — its
  sending infrastructure is US/EU, which would break the residency rule
  for the email path. SES in ca-central-1 keeps the whole sending stack in
  Montreal, is pay-per-message (cheap at MVP volume), and needs zero code
  (nodemailer `smtp-auth` transport already exists).
- **Consequence:** deliverability hardening (IP warm-up, dedicated IP,
  reputation management) is a Phase 9/10 concern; if it ever becomes a
  problem, the swap surface is small (SMTP env values + DNS), but the
  replacement must satisfy D-017.

### D-020: Seed never runs in production
- **Decision:** the seed script (`packages/prisma/seed-database.ts`) runs
  only when explicitly invoked (`npm run prisma:seed` / `prisma db seed`).
  The production path (`docker/start.sh` → `prisma migrate deploy`) never
  seeds; DEPLOY.md documents the guard. No code change was required.
- **Why:** seeding demo users/documents into a production database would
  be a data-integrity incident; upstream never wired seed into `migrate
  deploy`, and our image runs only `migrate deploy`.
- **Consequence:** the guard is documented (DEPLOY.md Sec. 4) and remains
  in force for every future deploy path (Coolify, CI, etc.).

### D-021: Trivial /api/health added; full observability deferred to Phase 9
- **Decision:** added an unauthenticated `GET /api/health` returning
  `{"status":"ok"}` in `apps/remix/server/router.ts` (small, justified
  code addition). It is side-effect free (no DB call) so uptime checks
  measure process liveness, not app depth. Monitoring for this phase is
  one UptimeRobot monitor + container logs + a weekly disk check
  (`docs/runbooks/05-monitoring.md`).
- **Why:** the Docker HEALTHCHECK, Caddy and UptimeRobot all need a stable
  liveness URL; upstream referenced /api/health in its start script but
  never implemented it. Metrics/tracing/log shipping are a Phase 9
  decision (hardening) — and when they land, they must satisfy D-017.
- **Consequence:** one new route in the Hono router; nothing else changed
  in the app. No new dependencies.

---

## 2026-09-01 — Phase 4: Bilingual EN/FR localization

### D-022: Cookie-based locale strategy, not /fr/* subdirectories
- **Decision:** keep upstream's cookie-based locale switching (`lang` cookie >
  `Accept-Language` > `en`) as the product's strategy; do NOT introduce
  `/fr/*` subdirectory routing. Added a `?lang=` query-param override
  (validated against supported locales, beats the cookie on that request so
  hreflang targets render correctly, and the choice persists into the cookie
  via the root loader's `Set-Cookie`).
- **Why:** upstream routes the entire product at the root with several hundred
  routes (auth, dashboard, admin, recipient signing tokens, API) plus emailed
  signing URLs (`/sign/{token}`) — prefixing all of it with `/fr` would have
  required touching every link/redirect/email template in the app and forked
  the URL surface for zero functional gain this phase. The spec's fallback
  clause applies: cookie-based switching with the tradeoff recorded.
- **Consequence:** SEO-weighted `/fr/*` URLs are deferred (recorded as a
  Phase 9/launch consideration); `.ca` TLD + `?lang=` alternates + hreflang
  (D-023) carry discovery for now. `LanguageSwitcher` ships in the public
  header/footer, auth pages, and the authenticated app header/footer.

### D-023: hreflang via `?lang=` alternates (cookie strategy constraint)
- **Decision:** root layout emits `<link rel="alternate" hreflang="en-CA"
  href="/?lang=en">`, `fr-CA` → `/?lang=fr`, and `x-default` → `/` on every
  page. Google strongly prefers distinct content URLs per locale; `?lang=` is
  the only crawlable URL variant available under D-022.
- **Why:** the spec requires hreflang on public pages; with a cookie-only
  strategy there are no distinct URLs to point at. The `?lang=` param is
  server-resolved (Step 2) so crawlers actually receive localized HTML.
- **Consequence:** acceptable for MVP; if Quebec SEO becomes a launch
  priority, revisit D-022 before Phase 9 marketing. Records that hreflang
  here is best-effort under constraint.

### D-024: Email locale chain kept as DocumentMeta.language → org → en (no schema change in Phase 4)
- **Decision:** emails localize through the shared Lingui catalog via
  `renderEmailWithI18N(template, { lang: emailLanguage })` where
  `emailLanguage = DocumentMeta.language || organisationGlobalSettings.documentLanguage || 'en'`.
  The envelope editor already exposes a per-document language picker that
  writes `DocumentMeta.language`; FROM name is the non-translatable brand
  constant "NorthSign" in both languages. No schema migration was added.
- **Why:** the target chain “recipient's locale → document owner's locale →
  en” requires new per-recipient and per-user `locale` columns plus
  plumbing through envelope creation, signing sessions and jobs. That is a
  compliance-workstream change (Phase 5, PIPEDA/Law 25), and Phase 4's
  rule is to reuse upstream infrastructure without structural schema
  drift. The per-document language picker + org default gives senders
  explicit control today.
- **Consequence:** recipients of fr envelopes get fr emails immediately;
  the recipient's own locale cannot auto-select until Phase 5. Gap logged
  in REVIEW-NOTES.md §4.4.

### D-025: PDF signature text localized; per-document dateFormat stays user-controlled; CAD via Intl
- **Decision:** the PDF signature dictionary reason and rejection stamp are
  now localized via `getI18nInstance(DocumentMeta.language)` in
  `seal-document.handler.ts`: « Signé électroniquement par NorthSign » and
  « DOCUMENT REFUSÉ » (missing-`signPdf` reason parameter added to
  `packages/signing`). `DocumentMeta.dateFormat` (luxon string the user
  picks per document) is NOT locale-switched — user preference wins.
  Currency is deferred to Phase 6 and will use `Intl.NumberFormat` CAD via
  `i18n.number` (the i18n layer already delegates to Intl, so no new
  infrastructure).
- **Why:** the legal wording “signé électroniquement” is the mandated
  fr-CA term (Charte de la langue française) and belongs in the signature
  dictionary; overwriting a user-chosen date format because the viewer's
  locale differs would corrupt signed-document presentation for no
  compliance gain; CAD formatting only matters once billing exists.
- **Consequence:** signed PDFs for fr-language documents carry the
  localized reason regardless of who opens them (it is stamped at seal
  time); date rendering follows locale in `i18n.date`-driven views and the
  user's format in document views; Phase 6 wires `i18n.number` with CAD.

### D-026: Account deletion orphans, does not destroy, documents others rely on
- **Decision:** the existing orphaning semantics in
  `packages/lib/server-only/user/delete-user.ts` + `orphan-envelopes.ts` are
  ratified as the NorthSign deletion policy (no code change to the core
  behavior): on account deletion, envelopes owned by the user in their own
  organisations are transferred to the **deleted-account service account**
  and flagged `deletedAt` (hidden from lists, retained verifiable); drafts
  and templates are hard-deleted; envelopes in teams owned by others are
  transferred to that team's organisation owner. The delete-account dialog
  and /terms §9 copy now describe exactly this behavior (previously the
  dialog claimed "all documents deleted", which was false). Deletion
  requests are processed via the DSAR runbook in `PRIVACY-OPS.md`.
- **Why:** signed documents are legal records co-signers rely on; destroying
  them would breach the expectations of third parties who never consented to
  the account holder's deletion, and PIPEDA/Law 25 retention-for-legal-use
  exceptions permit keeping evidence. Deleting users' *identity artifacts*
  (sessions, tokens, security logs cascade) still satisfies erasure of the
  account itself.
- **Consequence:** completed/pending documents outlive accounts and remain
  downloadable by recipients via their signing links; the deleted user's
  personal data no longer appears in the app; DSAR deletion requests are
  fulfilled in this shape and the refusal/limitation is explained per
  PRIVACY-OPS.md §3.

### D-027: Per-recipient email locale lands in Phase 5 Step 6 as Recipient.language (D-024 debt)
- **Decision:** the Phase 4 deferral (D-024) is resolved by adding a nullable
  `Recipient.language` column (`TEXT`, migration
  `20260902120000_recipient_language`; null = inherit document language). The
  sender picks a locale per signer in the envelope editor (languages list =
  `SUPPORTED_LANGUAGES`, validated by `ZDocumentMetaLanguageSchema`); the
  effective email locale chain becomes **`recipient.language` >
  `document.language` (DocumentMeta.language) > organisation
  `documentLanguage` > `'en'`** — closer to the original "recipient → owner
  → en" intent than the D-024 interim chain. Recipients who self-sign
  (`/sign/{token}`) continue to see the web UI in their own cookie/`?lang=`
  locale, which takes precedence over any stored value for the rendering
  page; the stored value only steers emails.
- **Why:** D-024 explicitly deferred this to Phase 5; a per-recipient locale
  is required for FR-first documents sent to EN co-signers (common Québec
  bilingual-agreement pattern) and is disclosed as a personalization
  preference, not tracking data.
- **Scope note (owner emails stay on document language):** emails addressed
  to the document **owner** (completion notice, rejection notice) are
  rendered in the document language; per-recipient locale applies only to
  emails addressed to that recipient (invitation, reminder, pending,
  rejection confirmation, cancellation, completion copy). Passing the
  recipient into `getEmailContext()` is therefore reserved for handlers
  whose sole addressee is that recipient.
- **Consequence:** ten catalogs already cover every UI string the feature
  emits (the picker reuses existing language names + a "Document language"
  inherit option); no new msgids. E2E and runtime QA (recipient-locale
  email received in the chosen language, inherit default unchanged) rides
  the Phase 5 operator QA pass; fr-CA translations pre-exist from Phase 4.

---

## 2026-09-02 — Phase 5.5: CI + automated E2E verification

### D-028: Baseline-count scripting for lint/tsc gates (never raise the baseline)
- **Decision:** CI does not run raw `biome check .` or a blanket
  `tsc --noEmit`; it runs two count-compare scripts. Biome fails only when a
  run exceeds the recorded baseline of **5 errors / 842 warnings**
  (`scripts/ci-biome-baseline.cjs`), and on excess it self-audits the
  offending file list and hard-fails if any repo-owned file (the northsign
  e2e suite, CI scripts, the northsign playwright config) carries a new
  diagnostic. TypeScript fails only on errors outside a known-errors
  allowlist of the 3 pre-existing Prisma-drift files in
  `packages/lib/server-only/` (`get-completed-fields-for-document.ts`,
  `get-active-subscriptions-by-user-id.ts`,
  `find-organisation-invoices.ts`) — note the allowlist file set was
  re-verified this session and differs from the file names quoted in earlier
  phase notes. `apps/remix` typechecks clean via `react-router typegen &&
  tsc` and is covered by the build step. Baselines may only be **lowered**;
  raising one requires a new DECISIONS.md entry. Repo-owned files can never
  be absorbed into the baseline.
- **Why:** upstream carries 5/842 Biome diagnostics and 3 drifted files that
  predate every NorthSign phase. A raw gate would fail every run forever
  (noise) or force us to "fix" upstream files and pollute the fork-merge
  surface (D-010). Count-compare keeps pre-existing noise visible (the
  script prints the numbers every run) while making any *new* diagnostic —
  ours or upstream's — a hard failure.
- **Consequence:** the scripts are self-auditing: a delta caused by our own
  code fails CI with the file list, so the baseline can never be used to
  hide NorthSign regressions. Verified locally this session: exactly 5
  errors / 842 warnings with zero diagnostics in repo-owned files, and 5
  allowlisted / 0 actionable tsc errors.

### D-029: E2E test-state strategy — UI-created state, zero secrets, no seed
- **Decision:** the Phase 5.5 suite (`packages/app-tests/e2e/northsign/`,
  dedicated `northsign.playwright.config.ts`) creates **all** of its own
  state through the real UI: signup (with signature pad + consent checkboxes)
  → upload of a committed tiny 1-page PDF → recipients → send. The seed
  script never runs in CI. Emails are consumed through an Inbucket REST
  client (list mailbox by local-part → fetch body → extract `/sign/{token}`
  links), and DB-level assertions (consent rows, envelope status, deletion
  orphaning) query Prisma directly where the UI cannot show the fact. The
  environment is zero-secret by construction: upload transport = database,
  SMTP = Inbucket container, signing = the repo's local example cert, jobs =
  local, OAuth client IDs empty — nothing can reach Stripe, SES, S3, or any
  OAuth provider. The upstream `packages/app-tests` suite remains untouched
  and continues to use seeded users.
- **Why:** the point of Phase 5.5 is to verify what Phases 1–5 actually
  built, on the exact path a new user takes; seeded demo state would mask
  signup/consent/first-run behavior and could never test the consent
  capture added in Phase 5. CI has Docker (the sandbox does not), so this
  closes the deferred-runtime-QA gap. Zero secrets makes the pipeline safe
  to run on every push of a public AGPL fork without a credentials
  checklist.
- **Consequence:** tests are slower than seed-based ones (real signup flow
  each time) but exercise the true user path; the four standing gates plus
  the glossary guard run with `workers: 1` to avoid cross-test DB coupling;
  the first CI run is expected red and each failure is triaged as a real
  bug. The Phase 4/5 operator runtime-QA checklists in PHASES.md are now
  covered by CI except visual text-expansion review (REVIEW-NOTES.md §4.5)
  and the pre-launch production smoke test, which stay manual.

### D-030: CI is the standing regression gate — every future phase ends green before handoff
- **Decision:** from Phase 5.6 onward, the GitHub Actions pipeline
  (`.github/workflows/ci.yml`: `Lint & Typecheck (baseline gates)` +
  `E2E (Playwright, zero secrets)`) is the definition of done for every
  phase. A phase is not complete until its branch ends with a green run on
  the base branch (dev), the biome/tsc baselines (D-028) hold, and the e2e
  gates relevant to the phase pass first-try or with a triaged, committed
  fix per root cause.
- **Why:** Phases 2–5 shipped never-runtime-verified features; the first CI
  run exposed four real bugs (signing-field insertion model, 12 h date
  forcing under fr-CA, English invite emails for fr-session documents, and
  a stale root-loader redirect) plus two test defects. CI is the only place
  the full boot → sign → complete → delete journey executes, so it must
  gate every handoff rather than being a post-hoc exercise.
- **Consequence:** future phases budget CI cycles up front; failures are
  classified test/app/infra and fixed at the root (one commit per root
  cause); the Phases 2/4/5 runtime-verification debt is retired except the
  pre-launch manual items (REVIEW-NOTES.md §4.5 visual text-expansion
  review, production smoke test, CI.md §6 branch protection).

---

## 2026-09-04 — Phase 6: Billing & monetization (NorthSign)

### D-031: EE billing surface is COMMERCIAL — NorthSign builds its own billing from scratch (D-009 resolved)
- **Decision:** Phase 6 (and any later billing work) is implemented **from
  scratch in AGPL code** (`packages/prisma`, `packages/lib`,
  `packages/trpc`, `apps/remix`). Nothing under `packages/ee` — the Stripe
  Billing Module (`server-only/stripe/*`, incl. the webhook handler),
  `limits/*`, and the internal claim/plan code — is imported, copied,
  extended, or invoked by any NorthSign billing path. D-009 is now resolved.
- **Why:** `packages/ee/LICENSE` is a COMMERCIAL license: production use
  requires a paid Documenso Enterprise subscription (per-license fees for
  the correct number of hosts). NorthSign is a commercial SaaS; shipping EE
  billing code would both license-breach and make revenue depend on a
  third party's per-seat pricing. The AGPL fork already *ships* the EE
  source (upstream tree), and AGPL app code routes like
  `api+/stripe.webhook.ts` still proxy to EE — Phase 6 **replaces** the
  billing touchpoints with our own implementation (audit: BILLING.md §1;
  EE files are read for audit only).
- **Consequence:** the EE billing UIs/routes remain physically in the tree
  (upstream AGPL app code calling EE) but are inert: NorthSign never sets
  `NEXT_PUBLIC_FEATURE_BILLING_ENABLED` (the EE module's own flag) and no
  NorthSign UI calls `enterprise.billing.*`. Removing the EE import surface
  entirely is a later-phase cleanup that must not touch AGPL-derived
  signing/org code paths this phase touches. AGPL-schema reuse is allowed
  and used (below).

### D-032: Schema — extend the AGPL Subscription table; new BillingUsageEvent journal; entitlements derived, no EE claims
- **Decision:** extend the existing AGPL `Subscription` model with nullable
  `provider` (BillingProvider MOCK/STRIPE), `plan` (BillingPlanType
  STARTER/PRO/BUSINESS), `periodStart`, and `paymentFailedAt` columns, and
  add an AGPL `BillingUsageEvent` table (organisationId FK cascade,
  envelopeId unique, sentAt) as the exactly-once "document sent" journal.
  No row = Starter (free tier needs no row). Entitlements are derived from
  the row at read time; usage is counted from the journal per usage window.
- **Why:** schema tables live in the AGPL `packages/prisma` package and are
  safe to adapt (D-031). The existing EE claim tables (`SubscriptionClaim` /
  `OrganisationClaim` quotas) are the EE plan engine; deriving NorthSign
  entitlements from claims would couple us to EE semantics and to rows the
  seed/migrations create for upstream reasons. Nullable columns keep every
  pre-existing row valid (free-tier-safe) and leave the EE code paths that
  still compile against `Subscription` untouched.
- **Consequence:** one reversible migration
  (`20260904000000_northsign_billing`, up/down validated on a scratch
  Postgres), prisma client regenerated. Migration cost: a few nullable
  columns + one small table with an index.

### D-033: Billing service seam — interface + Mock/Stripe providers, env-selected, CI runs mock
- **Decision:** all billing entry points go through a `BillingService`
  interface (`createCheckoutSession`, `createPortalSession`,
  `handleWebhookEvent`, …) with two implementations:
  `MockBillingService` (default; instant grants, deterministic, zero
  network/keys — CI and local dev) and `StripeBillingService` (test mode).
  Selection via `BILLING_PROVIDER=mock|stripe` (default mock). CI never sets
  `stripe`, so the pipeline stays secret-free by construction (D-029).
- **Why:** D-030 requires every phase to end green on CI with zero secrets;
  the mock provider makes the whole billing feature testable in CI (limit
  UX, plan grants, period math) without Stripe, while the stripe provider
  is exercised only by unit tests with fixture payloads and by the operator
  on a test-mode dev box.
- **Consequence:** new code may only depend on the interface; the Stripe SDK
  import stays inside the Stripe provider (tree-shaken out of mock-only
  paths by never being invoked, and safe to import since the client is
  constructed lazily with the env key).

### D-034: No free trials in v1 — the free Starter tier is the trial
- **Decision:** NorthSign v1 offers no trial periods (`trial_period_days` is
  never set at checkout). The always-free Starter plan (3 sends/month) is
  the trial: unlimited duration, no credit card required, upgrade any time.
- **Why:** trials add dunning/expiry states and a second downgrade path for
  zero v1 revenue benefit; a permanently-free tier with a hard usage cap is
  simpler to enforce, explain, and audit, and doubles as the product's
  marketing hook (bilingual signing is free on every plan, BILLING.md §2).
- **Consequence:** entitlement states are exactly Starter/Pro/Business ×
  ACTIVE/PAST_DUE/INACTIVE; Stripe's default period-end behavior ends
  unpaid subscriptions (no custom dunning in v1). Recorded in BILLING.md.

### D-035: UI surface — org-owner billing, public /pricing page, derived-usage banners
- **Decision:** v1 billing lives at **organisation** granularity with the
  **organisation owner** as the only billing actor (checkout, portal, and
  the `/settings/billing` overview all gate on `ownerUserId`); a public
  `/pricing` page (EN + fr-CA) drives sign-up or, for signed-in owners,
  straight into checkout; limit/payment-failed signals render as a global
  banner (`NorthSignBillingBanner`) plus send-flow toasts, all driven by the
  same derived numbers as the server gates (`getBillingOverview` tRPC route
  computing plan/usage/limits from the subscription row + usage journal).
- **Why:** Phase 5.5's signup creates a personal organisation owned by the
  user, so ownership is the simplest correct v1 authz rule; team/org billing
  roles arrive with Phase 8 teams. Deriving UI numbers from the same
  entitlement helpers as the enforcement path (`getEntitlement`,
  `getDocumentsRemaining`, `hasReachedDocumentLimit`,
  `isNearingDocumentLimit`) means the banner thresholds can never drift from
  what the send gate actually enforces. The upstream EE-claim billing UI
  (table of claims, EE portal) is replaced on owned orgs and suppressed for
  NorthSign-managed rows, since the EE portal route 500s on them.
- **Consequence:** non-owner members see the banner but cannot open
  checkout/portal (404 from the tRPC guard); the pricing page is fully
  public and locale-aware; `formatCadPrice` renders CAD locale-correctly
  (fr-CA: « 19 $ »); 96 new msgids entered the catalogs translated (REVIEW-
  NOTES §6) pending the Phase 9 human polish pass.

### D-036: CI Stripe secrets are operator-added — managed credential cannot write Actions secrets
- **Decision:** CI remains on the mock provider with **zero** Stripe
  secrets (D-029/D-033). Adding optional test-mode secrets
  (`STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`) for a future
  real-Stripe E2E is an operator task via the GitHub UI click-path recorded
  in BILLING.md §6.1 — the Freebuff-managed GitHub App token was verified
  (Phase 6 Step 6) to lack the Actions-secrets permission (403 on GET and
  PUT of `repos/…/actions/secrets`), so no API path exists from this
  workspace.
- **Why:** the managed credential is deliberately scoped; widening it is a
  workspace-security decision, not a phase task, and nothing in the phase
  requires real Stripe in CI (real test-mode E2E is an explicit stretch
  goal).
- **Consequence:** stretch-goal test-mode E2E waits for the operator to add
  the two secrets; until then the E2E suite proves the billing UX on mock,
  and the Stripe provider is proven by offline unit tests with fixture
  payloads and locally computed HMAC signatures.
