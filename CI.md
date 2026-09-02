# CI — Automated Lint + E2E Verification (Phase 5.5)

> The permanent regression gate for NorthSign. Every push and PR to `dev` and
> `main` runs the full suite with **zero real secrets**: upload transport is
> the database, all email lands in an Inbucket mail-catcher container, signing
> uses the repo's local example certificate, and jobs run locally. Nothing is
> capable of reaching Stripe, OAuth providers, SES, or S3.

---

## 1. Pipeline overview (`.github/workflows/ci.yml`)

**Triggers:** push to `dev`/`main` and PRs targeting them. A concurrency group
cancels superseded runs on the same ref.

### Job 1 — `lint` ("Lint & Typecheck (baseline gates)")

| Step | What it does | Why a script and not the raw command |
|---|---|---|
| `node scripts/ci-biome-baseline.cjs` | Runs `biome check .`, parses `Found N errors / M warnings`, fails only if **beyond** the recorded baseline of **5 errors / 842 warnings**. On excess, it re-parses the diagnostic file list and hard-fails if any repo-owned file (our e2e suite, CI scripts, playwright config) has new diagnostics — those must be fixed, never baselined. | Upstream carries 5 errors / 842 warnings of style noise. Raw `biome check` would fail every run forever. The baseline may only ever be **lowered**; raising it requires a `DECISIONS.md` entry. |
| `node scripts/ci-tsc-allowlist.cjs` | Runs `tsc --noEmit` per package and fails on any error outside a known-errors allowlist: the 3 pre-existing Prisma-drift files in `packages/lib/server-only/` (`get-completed-fields-for-document.ts`, `get-active-subscriptions-by-user-id.ts`, `find-organisation-invoices.ts`). `apps/remix` typechecks via `react-router typegen && tsc` and is clean. | Same principle: pre-existing upstream drift must not block every run, but any **new** error fails CI immediately. |

### Job 2 — `e2e` ("E2E (Playwright, zero secrets)")

1. **Service containers** started by GitHub Actions:
   - `postgres:16` on host port **54320** (matches the dev compose port) with
     `pg_isready` health checks.
   - `inbucket/inbucket` — SMTP on **2500**, REST API + web UI on **9000**.
2. `npm ci` (via the shared `./.github/actions/node-install` composite action,
   which also runs `prisma generate`).
3. `npm run prisma:migrate-deploy` — applies migrations only.
4. `npm run build -w @documenso/remix` — production build (translations +
   react-router build + server bundle).
5. Start `apps/remix/build/server/main.js` on port 3000.
6. **Poll `GET /api/health`** (the Phase 3 endpoint) until HTTP 200, 60 tries ×
   5 s; on timeout, dumps the last 100 app-log lines into the step log.
7. `npx playwright install --with-deps chromium`.
8. `npx playwright test --config packages/app-tests/northsign.playwright.config.ts`.
9. On failure: upload `test-results/`, `playwright-report/`, and the app log as
   artifacts (7-day retention). Traces/screenshots/video are captured for the
   failing run.

**The seed script never runs.** Tests create all of their own state through
the real UI (signup → upload → send), so CI validates the same path a new
user takes.

**Environment variables (job-level `env:`)** — all fake by construction:
database URL to the service container (credentials matching the dev compose:
`documenso`/`password`), `NEXT_PUBLIC_UPLOAD_TRANSPORT=database`,
`NEXT_PRIVATE_SIGNING_TRANSPORT=local` + `apps/remix/example/cert.p12`,
`NEXT_PRIVATE_JOBS_PROVIDER=local`, SMTP pointed at the Inbucket container,
empty OAuth client IDs, and `DANGEROUS_BYPASS_RATE_LIMITS=true`. There are no
GitHub secrets in this workflow at all. `.env.example` is copied to `.env`
for the `with:env`/prisma tooling (upstream convention); job-level env vars
take precedence for everything the tests exercise.

---

## 2. The four standing gates (Step 2 tests)

| Gate | File | Asserts |
|---|---|---|
| **EN flow** | `e2e/northsign/en-flow.spec.ts` | signup → upload (tiny committed 1-page PDF) → recipient → send → signing link extracted from Inbucket → sign → complete; envelope reaches `COMPLETED` in the DB; completion email arrives for the owner. |
| **FR flow** | `e2e/northsign/fr-flow.spec.ts` | Session switched via `/?lang=fr` (server-resolved per I18N.md §4); canary strings render — « Téléverser », « Piste d'audit »; dates render 24 h (no AM/PM); French invitation email; French completion page. |
| **Recipient locale** | `e2e/northsign/compliance.spec.ts` (first test) | Document language `en`, `recipient.language = 'fr'` → recipient's invitation email is French **and** owner-facing mail stays English. DB-level assertions on `Recipient.language` and `DocumentMeta.language`. This is the regression test for the `getEmailContext` bug fixed in Phase 5 Step 6 — it must never come back. |
| **Consent / export / deletion** | `e2e/northsign/compliance.spec.ts` (tests 2–4) | Signup records `UserConsentRecord` (ToS/Privacy version + timestamp, source `signup`) — via direct DB query where the UI cannot show it; marketing checkbox unchecked by default (no marketing row); export downloads a `northsign-data-export-*.json` archive; deleting an account with a completed document orphans it (row survives, still linked to the co-signer) instead of destroying it (D-026). |

**Gate 5 — Glossary guard** (`e2e/northsign/glossary.spec.ts`): scans rendered
text of key FR pages and fails on banned strings — see §4.

---

## 3. Running Playwright locally against the compose stack

One-time: `npm run dx` (installs, starts `docker/development/compose.yml` —
Postgres on 54320, Inbucket on 2500/9000, MinIO — migrates and seeds; the seed
is harmless for the northsign suite but is **not** required).

Then:

```bash
# Terminal 1 — the app (production-style server, like CI):
npm run build -w @documenso/remix
npm run with:env -- cross-env NODE_ENV=production node apps/remix/build/server/main.js

# Terminal 2 — the northsign suite only:
npx playwright test --config packages/app-tests/northsign.playwright.config.ts

# A single test file, headed, with retries off for debugging:
npx playwright test --config packages/app-tests/northsign.playwright.config.ts \
  e2e/northsign/en-flow.spec.ts --headed --retries=0
```

Useful: the Inbucket web UI at http://localhost:9000 shows every captured
email; `npm run prisma:studio` shows the DB state tests created.

The upstream suite still runs unchanged with
`npm run test:dev -w @documenso/app-tests` (it uses the seeded demo users and
the repo-root `playwright.config.ts`).

---

## 4. Adding a test to the northsign suite

1. Create `packages/app-tests/e2e/northsign/<topic>.spec.ts` (the
   `northsign.playwright.config.ts` `testDir` picks up everything there).
2. Reuse the helpers in `e2e/northsign/helpers.ts` instead of re-implementing
   flows: `signup()`, `createDocument()` (uploads the committed 1-page PDF
   fixture), `addRecipient()`, `continueEditor()`, `sendEnvelope()`, and
   `InbucketClient` (`waitForMessage` / `extractSigningLink`). Tests may also
   import `prisma` for DB-level assertions, as the gates do.
3. Every test must keep the zero-secrets rule: no provider other than the
   Postgres/Inbucket service containers, nothing outbound.
4. Lint it clean: `npx biome check --write <file>` — the baseline script fails
   CI if a repo-owned file carries any new diagnostic.
5. If the test needs new UI text, add it through Lingui (`<Trans>` / t``)
   and check the glossary in I18N.md §7 first — the glossary guard scans for
   banned strings and your new copy may be the thing that trips it.

---

## 5. Glossary guard (one source of truth)

`e2e/northsign/glossary.spec.ts` parses the banned strings from **I18N.md §7**
at runtime (the "never …" notes in the glossary table) and merges them with a
hardcoded core list so a parse failure can never silently pass. Banned today:
`e-mail`, `email`, « Journal d'audit », standalone `Importer` as an action
label. It scans the FR landing page, `/signin`, `/dashboard`,
`/settings/profile`, and the signing-page shell.

To extend the glossary: edit the table in I18N.md §7 (add a "never X" note).
The guard picks the new rule up automatically — no test edit needed. The
guard's own first test verifies the parse yields the core rules, so a
restructured I18N.md fails loudly instead of silently weakening the gate.

---

## 6. OPERATOR TASK — Branch protection (requires repo admin)

Require the e2e job green before merge to `main`:

1. GitHub → **your fork** → **Settings** → **Branches** (or *Rules → Rulesets*
   if the new rulesets UI is shown).
2. Under **Branch protection rules**, click **Add branch protection rule** (or
   **Edit** an existing rule for `main`).
3. **Branch name pattern:** `main`.
4. Check **Require a pull request before merging** (optional but recommended
   for a solo operator).
5. Check **Require status checks to pass before merging** — required.
6. In **Status checks that are required**, search for and add:
   - **`E2E (Playwright, zero secrets)`** — the e2e job's `name:` field.
   - **`Lint & Typecheck (baseline gates)`** — the lint job's `name:` field.
7. Check **Require branches to be up to date before merging** (optional; costs
   a re-run when `dev` moves).
8. **Save changes.**

Note: status checks only appear in the search box after the workflow has run
at least once on the default branch — push once, then complete this task.

Verify: open a PR from `dev` to `main` with a deliberately failing commit;
the merge button must stay blocked until CI is green.
