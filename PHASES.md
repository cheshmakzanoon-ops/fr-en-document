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
