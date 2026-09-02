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
| 3 | Canadian hosting & data residency (AWS ca-central-1) | pending operator provisioning |
| 4 | Bilingual i18n (EN/FR) with Lingui | **complete** |
| 5 | PIPEDA / Law 25 compliance workstream | **complete** (DRAFT-review gates pending) |
| 5.5 | CI + automated E2E verification | **complete** (first run expected red — real bugs; baseline gates verified locally) |
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
   `NEXT_PUBLIC_*` env defaults for the production domain (delivered in
   Phase 3, see below),
   signature-disclosure legal text finalization (Phase 5).

> **Phase renumber note:** Phase 3 was reordered during Phase 3 work —
> Canadian hosting & data residency now precedes bilingual i18n (the user's
> working plan: "Phase 3 = Canadian hosting & production infrastructure").
> DECISIONS.md entries D-015 and earlier predate this reorder; the new
> Phase 3 is documented below.

## Phase 3 — Canadian hosting & data residency (pending operator provisioning)

The repo-side Phase 3 deliverable set is **complete** (this section + the
runbooks); the phase only advances to **complete** once the operator has
provisioned AWS/DNS and passed the first-deploy smoke test.

1. **Deployment architecture + residency claim** — `DEPLOYMENT.md`:
   component diagram (VM, Postgres 16, S3, SES, Caddy, DNS), every
   component labeled ca-central-1 (Montreal), the exact claim wording
   ("data at rest and document processing occur in AWS ca-central-1,
   Montreal"), and what is NOT in Canada and why (commit `ae07e04`).
2. **Production deploy artifacts** — `docker/production/Dockerfile`
   (multi-stage, non-root, healthcheck), `docker-compose.prod.yml`
   (app + postgres:16 + Caddy auto-TLS, Coolify-compatible),
   `.env.production.example` with every variable documented (commit
   `c2eaae2`).
3. **Storage (S3)** — `docs/runbooks/01-storage-s3.md` + IAM policies in
   `docs/runbooks/policies/`: buckets in ca-central-1, public access
   blocked, versioning on documents, AppUser/BackupUser least-privilege.
   Upload transport is env-config-only; no code change (commit `cade38a`).
4. **Email (SES)** — `docs/runbooks/02-email-ses.md`: verify northsign.ca,
   DKIM/SPF/DMARC, SMTP credentials, sandbox exit, exact env values,
   sender no-reply@mail.northsign.ca. Nodemailer needs no code change
   (commit `2843ca1`).
5. **DNS** — `docs/runbooks/03-dns.md`: records table for northsign.ca,
   Cloudflare + registrar instructions, no MX (commit `592ab6b`).
6. **Backups & restore** — `scripts/backup.sh` (nightly pg_dump → S3,
   14 daily + 4 weekly retention) + `RESTORE.md` (fresh-VM restore drill,
   document versioning recovery) (commit `907f8f7`).
7. **VM hardening** — `docs/runbooks/04-vm-hardening.md`: Ubuntu 24.04,
   SSH key-only, ufw 22/80/443, unattended-upgrades, non-root deploy user
   in docker group, chmod-600 secrets, 2 GB swap, America/Toronto
   (commit `6d26b11`).
8. **First deploy + health** — unauthenticated `GET /api/health` added to
   the Hono router (Docker HEALTHCHECK / Caddy / UptimeRobot target) +
   `DEPLOY.md` first-deploy sequence, production seed guard, smoke-test
   checklist (commit `51113eb`).
9. **Monitoring (minimal)** — `docs/runbooks/05-monitoring.md`:
   UptimeRobot on /api/health, container log locations, weekly disk check.
   Full observability deferred to Phase 9 (commit `fb961df`).

### Status detail

- [x] DEPLOYMENT.md (architecture + residency claim + cost table)
- [x] Production Dockerfile, compose stack, Caddyfile, env template
- [x] S3 runbook + IAM policies
- [x] SES runbook
- [x] DNS runbook
- [x] backup.sh + RESTORE.md
- [x] VM hardening runbook
- [x] /api/health endpoint + DEPLOY.md (first deploy + smoke tests)
- [x] Monitoring runbook
- [x] DECISIONS.md D-017..D-021 (decisions below)
- [ ] **Operator provisioning (blocks the rest of the phase):** AWS
      account + ca-central-1 region, domain purchase/transfer for
      northsign.ca, VM instance, SES/DNS/S3 setup per runbooks 01–03,
      first deploy per DEPLOY.md, smoke test passed, quarterly restore
      drill scheduled
- [ ] Phase 3 exit criteria: smoke-test checklist fully green and the
      residency claim verifiable from the running stack (see handoff)

## Phase 4 — Bilingual i18n EN/FR (complete)

1. **I18N inventory** — `I18N.md`: Lingui v5 confirmed as the single
   translation system (web UI + react-email share one catalog,
   `packages/lib/translations/{locale}/web.po`); upstream ships an fr
   catalog (Crowdin community French, fr-FR-ish, 189 empty msgstrs);
   locale detection was cookie → Accept-Language → en, with the switcher
   only in the authenticated user menu.
2. **Locale strategy (D-022/D-023)** — cookie-based switching kept (no
   `/fr/*` subdirectories: spec fallback clause applied; hundreds of root
   routes + emailed `/sign/{token}` links make prefixing impractical).
   Added `?lang=` override (validated, beats cookie for the request,
   persists into the cookie), hreflang alternates `en-CA`/`fr-CA`/
   `x-default` in the root layout, and a new `LanguageSwitcher` in the
   public header + footer, auth pages, and authenticated header + footer.
3. **String extraction audit** — every hardcoded English UI string found
   (aria/title/alt labels, admin stats chart title, meta description/
   keywords/tagline, PDF text) routed through Lingui; the Phase 2 claim
   "strings stay extractable" verified ✓ with a small residue list that is
   intentionally not translatable (brand, protocol, attribution). See
   `I18N.md` §4a.
4. **fr-CA catalogs** — fr/web.po: 3,227 msgids, 100 % translated (374
   machine-translated ids logged in `REVIEW-NOTES.md` for the Phase 9
   polish pass); glossary (I18N.md §7) enforced: courriel (0 residual
   e-mail/email in msgstrs), téléversement, piste d'audit, « Signé » for
   the completed status, « vous » register. `scripts/fr-ca-tools.mjs`
   + `scripts/fr-ca-missing-*.json` kept as provenance/tooling.
5. **Email localization** — every react-email template renders through the
   shared catalog; chain `DocumentMeta.language → org settings → en`
   verified; the spec's recipient→owner→en intent needs a schema change
   and is deferred to Phase 5 (D-024); FROM name stays "NorthSign" in
   both languages.
6. **Formatting** — `i18n.date()`/`i18n.number()` (Intl) drive locales:
   fr-CA 24 h clock + AAAA-MM-JJ; per-document luxon `dateFormat` kept
   user-controlled (D-025); PDF signature reason localized (« Signé
   électroniquement par NorthSign ») + rejection stamp (« DOCUMENT
   REFUSÉ »), keyed off `DocumentMeta.language` in the seal job;
   CAD currency ready via `i18n.number` for Phase 6.
7. **QA sweep** — `npm run lint` (Biome) still at the standing baseline of
   **5 errors / 842 warnings** (no new diagnostics); `tsc --noEmit` clean
   on every touched file (apps/remix, packages/ui, packages/signing,
   packages/lib touched files; remaining lib/ui errors are pre-existing
   Prisma-drift/upstream in untouched files); `lingui compile` green for
   all 10 locales; fr catalog NUL-byte corruption found & fixed, verified
   0 NUL bytes + valid UTF-8 + glossary greps clean. Runtime click-through
   in both languages (sign-up → upload → send → sign → download) and
   text-expansion layout QA are **deferred to the operator machine**
   (sandbox has no Docker/Postgres — same limitation as Phases 1–2;
   checklist in the handoff below).
8. **Handoff** — `REVIEW-NOTES.md` (machine-translation log + polish-pass
   gate: nothing ships to marketing before Phase 9), `DECISIONS.md`
   D-022..D-025, this section, and the operator checklist below.

### Status detail

- [x] I18N.md inventory (library, catalogs, locales, detection, email
      locale, formatting, glossary)
- [x] D-022 cookie + `?lang=` strategy; D-023 hreflang alternates
- [x] LanguageSwitcher shipped in public header/footer, auth pages,
      authenticated header/footer; language cookie persists 2 years
- [x] Step 3 extraction audit: all hardcoded UI/meta/PDF strings routed
      through Lingui (see I18N.md §4a)
- [x] fr/web.po 100 % translated (3,227 ids); en/fr id sets identical
- [x] Glossary enforced (courriel / téléversement / piste d'audit /
      signataire / « vous »); residual fr-FR sweep logged for Phase 9
- [x] Email templates fr-CA via shared catalog; chain verified (D-024)
- [x] PDF stamp + signature reason localized (D-025); Intl formatting
      verified; CAD via i18n.number ready for Phase 6
- [x] Biome baseline unchanged (5 errors / 842 warnings); touched files
      tsc-clean; lingui compile green; catalog hygiene verified (no NULs)
- [x] REVIEW-NOTES.md (374 machine-translated ids + polish gate)
- [ ] **Operator machine (runtime QA):** `npm run dx` → `npm run dev` →
      full signing flow in EN and FR (sign-up → upload → recipient →
      send → sign → download, emails in Inbucket), verifying: zero
      English leakage in the fr flow; language switcher in header/footer
      on public + auth + dashboard pages; fr email received when the
      envelope language is set to Français; signed PDF shows « Signé
      électroniquement par NorthSign »; fr-CA dates render 24 h;
      text-expansion pass on buttons/nav/modals/table headers (see
      REVIEW-NOTES.md §4.5)

> **Phase 4 note:** Phase 3 (hosting) remains at "pending operator
> provisioning" — unrelated to Phase 4 completion; both land on the same
> operator run.

## Phase 5 — PIPEDA / Law 25 compliance workstream (complete)

Every legal-content artifact below carries a visible **"DRAFT — requires
review by a Canadian lawyer before public launch"** banner; that banner is a
**launch gate** recorded here (and in the Phase 10 gate list), not
decoration. Content was grounded in the Step 1 inventory of actual product
behavior — no aspirational claims.

1. **Compliance inventory** — `COMPLIANCE.md`: what personal information the
   app collects and where it lives (tables/fields), where it leaves the
   system (email, webhooks, PDFs, logs), existing audit-log tables, consent
   capture state, the account-deletion path (pre-Step-4 reality), cookie
   usage, and the processor list — each mapped against PIPEDA fair-information
   principles and Quebec Law 25, with a gap list that drove Steps 2–5
   (commit `0912b77`).
2. **Legal pages finalized** — `/terms` and `/privacy` with real content in
   EN + fr-CA: privacy-officer contact (`privacy@northsign.ca`), what we
   collect and why, the exact DEPLOYMENT.md residency claim wording,
   processors/sub-processors, retention (cross-referencing `RETENTION.md`),
   individual rights (access, rectification, portability, de-indexing), the
   incident-register commitment, and how to make a request. Draft banners
   visible on both pages; `TERMS_VERSION` / `PRIVACY_VERSION` constants live
   in `packages/lib/constants/brand.ts` (commit `fc12574`).
3. **Consent capture** — signup records ToS/Privacy acceptance with
   timestamp + version in a new `UserConsentRecord` table (append-only),
   plus a separate marketing opt-in checkbox **unchecked by default** (CASL
   express consent, source + timestamp stored). Transactional/signing emails
   are documented as legitimate-operational-need, not consent-gated
   (commit `8a4d760`).
4. **Data subject rights** — deletion-path wiring ratified as-is (D-026:
   orphaning, not destruction — pending/completed documents transfer to the
   deleted-account service account; drafts/templates hard-delete; the delete
   dialog now says exactly that, EN + fr). In-app **data export** (JSON:
   profile, consents, security log, owned-document metadata + recipients)
   at Settings → Profile. `PRIVACY-OPS.md` DSAR runbook: intake,
   identity verification, 30-day clock, request-log template
   (commit `8f293b0`).
5. **Retention & incident readiness** — `RETENTION.md` (documents + audit
   logs retained as legal records; security logs 12 mo; webhook calls,
   rate-limit counters, background jobs 90 d; consent records 3 y
   post-deletion; backups 14 daily/4 weekly) and `INCIDENT-RESPONSE.md`
   (definitions, roles, CAI/Law 25 + OPC/PIPEDA notification thresholds and
   clocks, breach-register template, annual tabletop) — both DRAFT-gated
   (commit `0dfefbe`).
6. **Per-recipient email locale (D-024 debt)** — `Recipient.language`
   (nullable = inherit) + envelope-editor picker; locale chain
   recipient.language > document.language > org documentLanguage > en;
   owner-facing emails stay on document language (D-027)
   (commits `15b7bcc` [catalog backfill], `a35b095`).

### Status detail

- [x] COMPLIANCE.md inventory + gap list (grounded in code as of `870d2e0`)
- [x] /terms + /privacy EN + fr-CA with DRAFT banners; version constants in
      `brand.ts`; page content grounded in Step 1
- [x] Consent capture migration + signup wiring (ToS/Privacy version +
      timestamp; CASL marketing opt-in unchecked by default); the
      transactional-vs-marketing distinction documented in /privacy §2
- [x] Deletion behavior defined + disclosed (D-026), delete dialog copy
      corrected in both languages; in-app data export shipped (PIPEDA access
      + Law 25 portability); PRIVACY-OPS.md DSAR runbook
- [x] RETENTION.md + INCIDENT-RESPONSE.md (DRAFT launch gates)
- [x] Per-recipient email locale shipped (D-027); D-024 resolved; I18N.md
      §5 and COMPLIANCE.md §1.2 updated; /privacy §2 discloses the
      email-language preference (EN + fr)
- [x] Biome baseline unchanged (5 errors / 842 warnings); `tsc --noEmit`
      clean on every touched package/file (packages/lib, packages/trpc,
      apps/remix — remaining lib errors are the three pre-existing
      Prisma-drift files); catalogs verified NUL-free
- [ ] **Lawyer review of every DRAFT legal artifact before public launch**
      (COMPLIANCE.md, /terms, /privacy, RETENTION.md, PRIVACY-OPS.md,
      INCIDENT-RESPONSE.md) — Phase 10 launch gate
- [ ] **Operator machine (runtime QA additions for Step 6):** with Docker/
      Postgres: set a signer's language to Français on an otherwise-EN
      document → invite/reminder/completion emails arrive in French while
      the owner's copy stays in English (rejection and completion notices);
      clearing the picker restores document-language behavior; default
      (unset) recipients see zero behavior change. Consent QA: new signup
      records ToS/Privacy version + timestamp and marketing opt-in only when
      checked. Export/deletion QA: Settings → Profile export downloads;
      account deletion orphans completed documents (still downloadable via
      signing links) and hard-deletes drafts/templates

> **Phase 5.5 note:** the Phase 4/5 operator runtime-QA checklists above are
> now **covered by CI** (Phase 5.5) except the explicitly manual items:
> visual text-expansion review (layout QA on real screens, see
> REVIEW-NOTES.md §4.5) and the pre-launch production smoke test.

## Phase 5.5 — CI + automated E2E verification (complete)

Five phases of work (rebrand, fr-CA localization, consent/export/deletion,
recipient locale) had never been runtime-verified — this sandbox has no
Docker. GitHub Actions can run Docker, so Phase 5.5 converts the deferred
manual QA checklists into automated tests that run on every push and becomes
the permanent regression gate for all future phases. Working document:
`CI.md`. First run is **expected to be red** — every failure is a real bug
found before billing exists.

1. **Workflow scaffold** — `.github/workflows/ci.yml` replaces the upstream
   build-only pipeline: push/PR to `dev` and `main`, concurrency group
   cancels superseded runs. Two jobs:
   (a) **lint** — `npm ci`, Biome via the baseline-count script, tsc via the
   known-errors-allowlist script (both below);
   (b) **e2e** — `postgres:16` service container on 54320 (dev compose port),
   `inbucket/inbucket` service container (SMTP 2500, REST 9000), `npm ci`,
   `prisma migrate deploy`, production build of `@documenso/remix`, start the
   server, poll `GET /api/health` (Phase 3 endpoint) until 200 with timeout +
   log dump, install Playwright + chromium, run the northsign suite, upload
   traces/screenshots/videos + app log on failure. **The seed script never
   runs** — tests create their own state via the UI. Zero secrets by
   construction: upload transport = database, email = Inbucket, signing =
   repo's local example cert, jobs = local, OAuth client IDs empty. Nothing
   outbound.
2. **Baseline-count gating** — pre-existing upstream diagnostics must not
   fail every run, and new NorthSign diagnostics must never be hidden:
   `scripts/ci-biome-baseline.cjs` (fails only beyond 5 errors / 842
   warnings; on excess, self-audits the offending file list and hard-fails if
   any repo-owned file regressed) and `scripts/ci-tsc-allowlist.cjs`
   (per-package tsc; fails on anything outside the 3 known Prisma-drift
   files). Verified locally this session: exactly 5/842 and 0 actionable tsc
   errors.
3. **Test harness** — `packages/app-tests/northsign.playwright.config.ts`
   (dedicated config: baseURL http://localhost:3000, retries 1, trace
   retained on retry, 1 worker, upstream suite untouched) +
   `e2e/northsign/helpers.ts` (UI signup incl. signature pad, document
   upload from a committed 1-page PDF fixture, recipient add, envelope send,
   and an Inbucket REST client: list mailbox → fetch body → extract
   `/sign/{token}` links).
4. **The four standing gates** (`e2e/northsign/en-flow.spec.ts`,
   `fr-flow.spec.ts`, `compliance.spec.ts`):
   EN flow (signup → upload → recipient → send → sign from the Inbucket link
   → complete → completion email); FR flow (canaries « Téléverser », « Piste
   d'audit », 24 h dates, French emails + completion page); recipient-locale
   regression (document en + recipient fr → recipient email French, owner
   email English — the `getEmailContext` bug from Phase 5 Step 6 must never
   come back); consent/export/deletion (consent rows via direct DB query,
   marketing unchecked by default, JSON export downloads, deletion
   orphans-but-does-not-destroy a co-signed document per D-026).
5. **Glossary guard** (`e2e/northsign/glossary.spec.ts`) — scans rendered FR
   pages (landing, signin, dashboard, settings, signing shell) for banned
   strings (`e-mail`, `email`, « Journal d'audit », standalone `Importer`),
   with the banned list parsed live from I18N.md §7 so the glossary keeps one
   source of truth.
6. **Docs + operator task** — `CI.md`: pipeline reference, local Playwright
   run against the compose stack, how to add tests, and the exact GitHub
   branch-protection settings path (Settings → Branches → Branch protection
   rule for `main` → require status checks `E2E (Playwright, zero secrets)`
   + `Lint & Typecheck (baseline gates)`) recorded as an operator task.

### Status detail

- [x] ci.yml (lint + e2e jobs, service containers, health poll, artifacts)
- [x] Baseline-count scripts (biome 5/842; tsc 3-file allowlist), verified
      locally; baselines may only be lowered (D-028)
- [x] Playwright config + harness + committed 1-page PDF fixture
- [x] EN / FR / recipient-locale / consent-export-deletion gates
- [x] Glossary guard sourced from I18N.md §7
- [x] CI.md + branch-protection operator task
- [x] PHASES.md/DECISIONS.md updated; no upstream refactors beyond what
      CI/E2E required (only the workflow file was replaced)
- [ ] **Operator: push `dev` to trigger the first CI run** (expected red);
      triage each failure as a real bug
- [ ] **Operator: complete the branch-protection task in CI.md §6** after the
      first successful run registers the check names
- [ ] **Remains manual (pre-launch):** visual text-expansion review
      (REVIEW-NOTES.md §4.5) and the production smoke test
