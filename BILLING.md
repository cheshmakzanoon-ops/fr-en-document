# BILLING — NorthSign billing & monetization (Phase 6)

> Phase 6 working document. NorthSign is built on the AGPL-3.0 Documenso
> fork; **every line of billing code in this phase is written by us from
> scratch** and lives in AGPL-licensed code (`packages/prisma/schema.prisma`,
> `packages/lib`, `packages/trpc`, `apps/remix`). Nothing under
> `packages/ee` (COMMERCIAL license) is imported, copied, or modified for
> this feature. See DECISIONS.md D-031 (this resolves D-009).
>
> All Stripe work is TEST MODE. There are no live keys, no real charges, and
> CI runs entirely on the **mock** billing provider with zero secrets.

---

## 1. EE audit — what exists upstream and what we do instead

`packages/ee` carries the Documenso **Commercial License** (`packages/ee/LICENSE`):
production use requires a paid Documenso Enterprise subscription. `packages/ee/FEATURES`
names the licensed feature list; the billing-relevant parts are:

| Surface (all under `packages/ee/server-only/`) | What it is | Verdict |
|---|---|---|
| `stripe/create-checkout-session.ts` | Checkout session (subscription mode, no tax, no promo codes) | EE — NOT reused |
| `stripe/create-customer.ts`, `update-customer.ts`, `get-customer.ts` | Stripe customer CRUD | EE — NOT reused |
| `stripe/get-subscription.ts`, `sync-stripe-customer-subscription.ts` | Fetch/sync Stripe subscription → local `Subscription` + claim rows | EE — NOT reused |
| `stripe/get-portal-session.ts` | Billing portal session | EE — NOT reused |
| `stripe/get-invoices.ts` | Invoice list | EE — NOT reused |
| `stripe/get-internal-claim-plans.ts`, `is-price-seats-based.ts`, `update-subscription-item-quantity.ts` | Internal claim/plan catalog, seat plans | EE — NOT reused |
| `stripe/webhook/handler.ts` | Signature-verified webhook → full customer sync | EE — NOT reused |
| `limits/*` (server, client, handler, provider) | Plan "limits" API (documents/recipients/direct-templates vs FREE_PLAN_LIMITS 5/10/3), only active when `NEXT_PUBLIC_FEATURE_BILLING_ENABLED=true` | EE — NOT reused |
| `lib/*` (email domains, org account linking) | Org SSO/email-domain features | EE — NOT reused (not billing) |
| `signing/csc/*` | Cloud Signature Consortium QES signing | EE — NOT reused (not billing; pre-existing fork surface, out of Phase 6 scope) |

**What IS AGPL-safe to reuse (schema):** `packages/prisma/schema.prisma` is AGPL.
The existing `Subscription` / `SubscriptionClaim` / `OrganisationClaim` /
`OrganisationMonthlyStat` models and the `Organisation.customerId` /
`Subscription.organisationId` columns were written by upstream under AGPL and
may be adapted. Phase 6 **extends** the AGPL `Subscription` model with our own
plan/provider/period columns and adds a new AGPL `BillingUsageEvent` table; it
does **not** touch the EE claim machinery for entitlements. AGPL utility code
we build on: `packages/lib/universal/monthly-period.ts`,
`packages/lib/universal/quota-usage.ts`.

**What we avoid entirely:** every `@documenso/ee` import for billing —
`apps/remix/app/routes/api+/stripe.webhook.ts` (currently proxies to the EE
webhook handler) is **replaced** by our own handler, and the EE
`enterprise.billing.*` tRPC routes are left untouched but are never called by
any NorthSign UI. The upstream EE billing UIs (`/o/{orgUrl}/settings/billing`,
`billing-plans.tsx`, `enterprise-router`) remain in the tree as upstream AGPL
app code that calls EE; they are inert for NorthSign (no
`NEXT_PUBLIC_FEATURE_BILLING_ENABLED`, no Stripe keys in dev/CI) and are
candidates for removal in a later phase — they are **not** part of the
NorthSign billing path.

---

## 2. Pricing (decision of record, implement as given)

| | **Starter (Free)** | **Pro** | **Business** |
|---|---|---|---|
| Price | $0 | **$19 CAD/mo** or **$190 CAD/yr** | **$49 CAD/mo** or **$490 CAD/yr** |
| Documents sent | 3 / month | Unlimited | Unlimited |
| Recipients per document | 2 | Unlimited | Unlimited |
| Templates | — | ✔ | ✔ |
| API access | — | ✔ | ✔ |
| Team features | — | — | ✔ (gated in Phase 8) |
| Support | Community | Standard | Priority |
| Per-recipient locale (EN/fr-CA emails) | ✔ **FREE forever** | ✔ | ✔ |

Rules locked in:

1. **Per-recipient locale stays free.** Bilingual signing is the NorthSign
   brand differentiator (D-004/Phase 4/5); it is not a gateable feature.
   `Recipient.language` (Phase 5 Step 6) remains available on every plan.
2. **No free trials in v1.** The free Starter tier *is* the trial — unlimited
   duration, 3 sends/month. Recorded in DECISIONS.md D-034. Stripe Checkout
   will not use `trial_period_days`.
3. **Taxes.** Prices are displayed exclusive of tax. GST/HST/QST are
   calculated by Stripe Tax at checkout from the customer's address
   (`automatic_tax: { enabled: true }`, currency `cad`). Tax-ID collection is
   enabled for B2B buyers (`tax_id_collection: { enabled: true }`). No fake
   tax numbers exist anywhere in code, tests, or fixtures — the go-live
   checklist below notes that real registration numbers are a launch item.
4. **Starter usage window.** Free usage counts per UTC calendar month. Paid
   usage counts per Stripe billing period (`current_period_start` →
   `current_period_end`). On downgrade to Starter, the free window starts at
   `max(start of current UTC month, end of the last paid period)` so a
   downgrade never instantly locks a sender.
5. **Counting rule.** A "document sent" is counted **once**, when an envelope
   first transitions DRAFT → PENDING (exactly-once journaled in
   `BillingUsageEvent`, keyed on `envelopeId`). Re-sends, recipient
   reminders and redistributions do not count. Draft uploads are free on all
   plans — the Starter limit is on *sending*, not on creating drafts.
6. **Business team features** (teams >1, members, shared settings) are
   **gated in Phase 8**; Phase 6 only sells the plan and records the intent.

---

## 3. Architecture

### 3.1 Service seam

```
apps/remix routes / tRPC / jobs / lib server actions
        │  (depend only on the interface)
        ▼
BillingService  (packages/lib/server-only/billing/billing-service.ts)
   ├── MockBillingService  (BILLING_PROVIDER=mock — default; CI/dev)
   └── StripeBillingService (BILLING_PROVIDER=stripe — test mode)
```

- Env: `BILLING_PROVIDER=mock|stripe` (**default `mock`**).
- All app code imports `getBillingService()`; nothing outside the providers
  touches Stripe or knows about webhook signing.
- CI is secret-free by construction: it never sets `BILLING_PROVIDER=stripe`,
  so the Stripe SDK path is never exercised and no Stripe key is required.

### 3.2 Data model (AGPL, migration `20260904000000_northsign_billing`)

`Subscription` (extended, all new columns nullable so existing rows and the
free tier are untouched):

| Column | Type | Meaning |
|---|---|---|
| `provider` | enum `BillingProvider` (`MOCK`, `STRIPE`) | Who manages this row |
| `plan` | enum `BillingPlanType` (`STARTER`, `PRO`, `BUSINESS`) | NorthSign plan |
| `periodStart` | `DateTime?` | Current period start (Stripe `current_period_start`) |
| `periodEnd` (existing) | `DateTime?` | Current period end (Stripe `current_period_end`) |
| `paymentFailedAt` | `DateTime?` | Set by `invoice.payment_failed`, cleared on success — drives the PAST_DUE banner |

Existing columns reused with their upstream meaning: `planId` = Stripe
subscription id (unique), `priceId` = Stripe price id, `customerId` = Stripe
customer id, `status` (`ACTIVE`/`PAST_DUE`/`INACTIVE`),
`cancelAtPeriodEnd`, `organisationId` (unique 1:1 org). **A missing
`Subscription` row means Starter.** Rows are only written when a user
upgrades (mock) or Stripe reports a subscription (test mode).

`BillingUsageEvent` (new): exactly-once "document sent this period" journal.

| Column | Meaning |
|---|---|
| `organisationId` (FK, cascade) | Billing org that sent |
| `envelopeId` (String, unique) | Envelope counted — uniqueness makes accounting idempotent under retries |
| `sentAt` | When the envelope first went out (default now) |

Usage for a period = `count(BillingUsageEvent where organisationId = ? and
sentAt >= periodStart)`. Entitlement enforcement inserts the event inside the
same transaction that flips DRAFT → PENDING, after locking the org row, so
concurrent sends cannot overshoot the Starter cap.

### 3.3 Entitlement resolution (server, always on)

`getOrganisationEntitlement(organisationId)` → plan + quota, resolved from
the org's `Subscription` row (none → Starter):

- Starter: 3 documents/period, 2 recipients/document, no templates, no API.
- Pro/Business: unlimited documents & recipients, templates + API enabled.
- Business additionally carries `teamFeatures: true` (enforced Phase 8).
- The plan is also exposed on the session payload (`getOrganisationSession`
  already includes `subscription`), so UI chrome can react without extra
  round-trips.

### 3.4 Provider behavior

**Mock (CI/dev):**
- `createCheckoutSession` returns an internal URL that completes instantly
  (grant/update the org's `Subscription` row with `provider=MOCK`).
- `createPortalSession` returns a mock URL (no-op page).
- Webhook handler accepts and acknowledges; never parses Stripe payloads.
- Deterministic price/plan resolution — no network, no keys.

**Stripe (test mode):**
- `createCheckoutSession({ plan, interval })`: Checkout `mode: subscription`,
  `currency: cad`, the monthly or annual price id for the plan,
  `automatic_tax: { enabled: true }`, `allow_promotion_codes: true`,
  `tax_id_collection: { enabled: true }`, `customer` (creating/linking the
  org's Stripe customer), success/cancel URLs back to `/settings/billing`.
- `createPortalSession`: Customer Portal (self-serve upgrade/cancel/payment
  method/invoices).
- `handleWebhookEvent`: signature verification with
  `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`, typed event switch (see §4.2),
  idempotent upserts keyed on the Stripe subscription id.

---

## 4. Stripe integration (test mode)

### 4.1 Local dev loop

```bash
# Terminal 1 — forward Stripe events to the local app (from repo root):
stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
  --api-key sk_test_...   # prints: whsec_...  → put in .env.local as NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET

# Terminal 2 — app with billing on Stripe:
#   .env.local:
#     BILLING_PROVIDER=stripe
#     NEXT_PRIVATE_STRIPE_API_KEY=sk_test_...
#     NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET=whsec_...
#     NEXT_PRIVATE_STRIPE_PRICE_PRO_MONTHLY=price_...
#     NEXT_PRIVATE_STRIPE_PRICE_PRO_ANNUAL=price_...
#     NEXT_PRIVATE_STRIPE_PRICE_BUSINESS_MONTHLY=price_...
#     NEXT_PRIVATE_STRIPE_PRICE_BUSINESS_ANNUAL=price_...
npm run dev
```

Trigger events by hand (test cards: `4242 4242 4242 4242`, any future date,
any CVC):

```bash
# Complete a checkout for the Pro monthly price (creates the subscription):
stripe checkout sessions create \
  --mode subscription \
  --line-items "[{price: 'price_xxx', quantity: 1}]" \
  --success-url "http://localhost:3000/settings/billing" \
  --cancel-url "http://localhost:3000/settings/billing" \
  --api-key sk_test_... --expand "[]"    # then open the returned url in the browser

# …or simulate the webhook events directly:
stripe trigger customer.subscription.updated
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed      # watch: org flips PAST_DUE + banner
stripe trigger customer.subscription.deleted  # watch: org returns to Starter
```

Webhook endpoint: `POST /api/stripe/webhook` (replaces the upstream EE proxy).

### 4.2 Handled events

| Event | Local effect |
|---|---|
| `checkout.session.completed` | If `mode=subscription`: upsert `Subscription` (provider STRIPE, plan from price, `periodStart`/`periodEnd`, status ACTIVE) |
| `customer.subscription.updated` | Upsert status/period/plan/`cancelAtPeriodEnd` from the Stripe object (converges plan changes, renewals, cancel-at-period-end) |
| `customer.subscription.deleted` | `status=INACTIVE`, `cancelAtPeriodEnd=false`, keep row (entitlement falls back to Starter; usage window rule §2.4) |
| `invoice.payment_failed` | Log + set `status=PAST_DUE`, `paymentFailedAt=now` → UI banner. **No custom dunning**: Stripe's default retry + cancel-at-period-end behavior applies |
| `invoice.paid` | Clear `paymentFailedAt`, restore ACTIVE when the subscription is active |

Idempotency: handlers are convergent upserts keyed on the Stripe subscription
id (`planId` unique). Replaying any event converges to the same row; a
`checkout.session.completed` that races a later `subscription.deleted` simply
re-applies the latest Stripe truth on the next event. Unknown/unsupported
events are acknowledged with 200 and ignored.

### 4.3 Env vars (placeholders only — no committed values)

App code reads: `BILLING_PROVIDER` (unset → mock), `NEXT_PRIVATE_STRIPE_API_KEY`,
`NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`, and the four price ids
`NEXT_PRIVATE_STRIPE_PRICE_{PRO,BUSINESS}_{MONTHLY,ANNUAL}`.

**Operator task (Phase 6 build sandbox cannot edit `.env*` files — the
platform write-protects them):** paste this block (empty values) into
`.env.example` **and** `.env.production.example` under the `[[STRIPE]]`
section so the templates carry the Phase 6 placeholders:

```dotenv
# NorthSign billing (Phase 6): BILLING_PROVIDER=mock|stripe (default mock).
# stripe uses TEST MODE keys only; never put live keys here.
BILLING_PROVIDER=
NEXT_PRIVATE_STRIPE_API_KEY=
NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET=
# Test-mode price ids for the NorthSign plans (monthly/annual, CAD).
NEXT_PRIVATE_STRIPE_PRICE_PRO_MONTHLY=
NEXT_PRIVATE_STRIPE_PRICE_PRO_ANNUAL=
NEXT_PRIVATE_STRIPE_PRICE_BUSINESS_MONTHLY=
NEXT_PRIVATE_STRIPE_PRICE_BUSINESS_ANNUAL=
```

CI keeps `BILLING_PROVIDER` unset → mock. Real test-mode keys live only in
local `.env.local` and in the repo's GitHub Secrets if the operator adds them
(see §8 step 7).

---

## 5. Entitlement enforcement matrix (sender actions only)

Recipients are **never** blocked mid-signing; every gate below is a sender
action, enforced server-side (not just hidden in UI).

| # | Surface | Rule | Where enforced |
|---|---|---|---|
| 1 | Document send (all paths: editor, bulk send job, template use, API) | ≤ documents-per-period allowed | `send-document.ts` — org row lock + count inside the DRAFT→PENDING transaction; `BillingUsageEvent` insert |
| 2 | Recipients per document | ≤ recipients/document | `send-document.ts` (replaces the upstream claim-based check) + the direct-template send path |
| 3 | Templates — create / save-as-template / use | Pro+ only | `create-envelope.ts` (type TEMPLATE), `duplicate-envelope.ts` (`duplicateAsTemplate`), `create-document-from-template.ts`, direct-template creation path |
| 4 | API access — token creation + request | Pro+ only | `api-token-router` create + tRPC v2 `authenticatedMiddleware` + API v1 middleware (both assert org entitlement per request, so tokens die on downgrade) |
| 5 | Plan visible on session | — | `get-organisation-session` includes the (extended) `subscription`; banners/CTAs read it |

Limit UX: a banner above the documents list shows remaining sends and links
to `/pricing` when the Starter account is at or near its 3-send cap; the send
dialog surfaces a localized error with an upgrade CTA when the server rejects
the send. PAST_DUE shows a "payment failed — update your payment method"
banner; the subscription stays usable until Stripe's default
period-end behavior ends it.

---

## 6. Tests (Phase 6 Step 6)

- **Unit** (vitest, `packages/lib`): webhook event → subscription upsert for
  each handled event against fixture payloads with an offline
  `STRIPE_WEBHOOK_SECRET` (signature verification exercised via
  `stripe.webhooks.generateTestHeaderString`), entitlement limit math, and
  period-boundary counting (usage window start rules, exactly-once
  `envelopeId`).
- **E2E** (Playwright, mock provider, northsign suite):
  1. Free user sends 3 documents → 4th blocked, banner + upgrade CTA shown.
  2. Mock-Pro user (upgraded through the mock checkout completion URL) sends
     freely past 3.
  3. `/pricing` renders in EN and fr-CA.
- CI runs `BILLING_PROVIDER=mock` and needs **zero** Stripe secrets.
  Real test-mode Stripe E2E is a stretch goal only (see §8).

### 6.1 Optional: real test-mode Stripe secrets for CI (NOT required)

CI stays on the mock provider; these secrets only enable a future real
Stripe test-mode E2E run. Attempted automatically in Phase 6 Step 6: the
Freebuff-managed GitHub App credential (`freebuff-web[bot]`) is
installation-scoped **without** the `actions: write` / secrets-admin
permission — the API returned
`403 Resource not accessible by integration` for both listing and creating
`repos/…/actions/secrets`. Add them manually via the exact click-path:

1. GitHub → repository **cheshmakzanoon-ops/fr-en-document** →
   **Settings** → (left sidebar) **Secrets and variables** → **Actions**.
2. **New repository secret** → Name:
   `STRIPE_TEST_SECRET_KEY` — Value: your `sk_test_…` key from
   [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys).
3. **New repository secret** → Name:
   `STRIPE_TEST_WEBHOOK_SECRET` — Value: the `whsec_…` signing secret of
   your **test-mode** webhook endpoint
   (Developers → Webhooks → the endpoint → *Signing secret* → reveal/copy).
4. (Optional, for the stretch-goal E2E) also add
   `STRIPE_TEST_PRICE_PRO_MONTHLY`, `STRIPE_TEST_PRICE_PRO_ANNUAL`,
   `STRIPE_TEST_PRICE_BUSINESS_MONTHLY`, `STRIPE_TEST_PRICE_BUSINESS_ANNUAL`
   — the four `price_…` ids created in §4.1's local dev loop.
5. Wire them into a job only when the stretch-goal test-mode E2E is built:
   map them to `NEXT_PRIVATE_STRIPE_API_KEY`,
   `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`, and
   `NEXT_PRIVATE_STRIPE_PRICE_*` in the job's `env:` and set
   `BILLING_PROVIDER: stripe` for that job only. The default CI job keeps
   running mock and never reads them.

No secret values are committed anywhere in this repository (env-example
placeholders only, §4.3).

---

## 7. What we are deliberately NOT building in v1

- No trials (free tier is the trial). No coupons UI (Stripe promo codes
  enabled at checkout only). No seats/quantities. No dunning flow (Stripe
  default period-end behavior). No invoices database table (invoice history
  lives in Stripe/Customer Portal). No usage metering beyond the send count.
  Business "team features" enforcement is Phase 8 (the plan is sellable now).

---

## 8. GO-LIVE CHECKLIST — launch blockers, NOT build blockers

> Nothing below blocks building or testing (Phase 6 ships on mock + test
> mode). Every item blocks *collecting real money*. Stripe charges in real
> life are disabled until this list is done.

- [ ] **Incorporate** (entity + tax ID needed for Stripe payouts). Sole
      proprietorship is acceptable to Stripe but confirm with an accountant.
- [ ] **GST/HST registration decision**: the small-supplier threshold is
      $30,000 CAD of taxable revenue over four consecutive quarters — flag
      for an accountant whether/from when NorthSign must register (GST/HST +
      QST if Québec nexus). No fake tax numbers anywhere until then.
- [ ] Stripe account verification + bank account for payouts (test mode
      needs neither).
- [ ] Create **live-mode** products/prices in Stripe and set the
      `NEXT_PRIVATE_STRIPE_PRICE_*` env vars for production (test-mode price
      ids live only in local/test env).
- [ ] Flip test → live keys: `NEXT_PRIVATE_STRIPE_API_KEY`,
      `NEXT_PRIVATE_STRIPE_WEBHOOK_SECRET`, `BILLING_PROVIDER=stripe`.
- [ ] Register the **live-mode webhook endpoint**
      `https://app.northsign.ca/api/stripe/webhook` and enable the events in
      §4.2 (test-mode endpoint already points at the dev/staging host).
- [ ] Production smoke test: purchase Pro monthly with a real card, cancel
      in the portal, verify the period-end downgrade; repeat for Business.
- [ ] Confirm Stripe Tax settings (GST/HST/QST) with an accountant before
      first sale; tax IDs collected for B2B at checkout.
