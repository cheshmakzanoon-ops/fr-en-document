# RETENTION — Data Retention Schedule

> **Phase 5, Step 5.** Authoritative retention schedule for personal
> information processed by NorthSign. **DRAFT — requires review by a Canadian
> lawyer before public launch.** Grounded in the Step 1 inventory
> (`COMPLIANCE.md`); referenced by `/privacy` §5 and `PRIVACY-OPS.md`.

---

## 1. Principles

- Signed documents and their audit trails are **retained as legal records** —
  they are evidence other parties rely on (see DECISIONS.md D-026). They are
  not deleted on request of the sender alone.
- Everything else is kept only as long as needed for the purpose it was
  collected for, then deleted or de-identified.
- "Deleted" below means: removed from the production database and, within one
  backup cycle, purged from backups by expiry (backups roll off per §3).

## 2. Schedule

| Data | Where (COMPLIANCE.md ref) | Retention | Trigger / notes |
|---|---|---|---|
| **Documents (envelopes)** — pending, rejected, completed | `Envelope` + items, `DocumentData`, S3 `northsign-documents` | **Retained** (legal records) | Orphaned to the deleted-account service account on account deletion (D-026). Hidden from UI; remains verifiable by co-signers. |
| Draft documents & templates of a **deleted account** | `Envelope` type TEMPLATE / DRAFT | Deleted at account deletion | Hard delete via `orphanEnvelopes` cascade. |
| **Document audit logs** | `DocumentAuditLog` (IP, UA, names, events) | **Retained** with the document | Evidentiary trail rendered into the signing certificate; not pruned independently. |
| Account security logs | `UserSecurityAuditLog` | **12 months** | Signed-in activity evidence; purged by scheduled job (deferred — see §5). |
| Active sessions | `Session` | Life of session + purge at deletion | Cascade-deleted with the user row. |
| Consent records | `UserConsentRecord` | **3 years** after account deletion, then deleted | CASL/PIPEDA demonstrable-consent window; append-only. |
| **Account data** (profile, credentials, signature image, 2FA) | `User`, `Account`, `Passkey`, etc. | Deleted at account deletion (immediate hard delete) | Cascades wipe all auth artifacts. Recipient rows the user created as a *signer* on others' documents are retained with those documents. |
| Recipient data on live documents | `Recipient`, `Signature`, `Field` | With the document | Legal record of participation. |
| Email verification / password-reset tokens | `VerificationToken`, `PasswordResetToken` | Until expiry | Already expiry-bound in code. |
| Webhooks & webhook calls | `Webhook`, `WebhookCall` | Webhooks: with owner. **Call payloads: 90 days** | Call logs may include recipient emails; purge job deferred (§5). |
| Rate-limit counters | `RateLimit` | **30 days** rolling | Pseudonymous abuse-prevention counters. |
| Background-job payloads | `BackgroundJob`, `BackgroundJobTask` | **90 days** after completion | Payloads can contain emails/names. |
| Support tickets | Plain (external processor) | Per Plain retention; minimum necessary | Processor disclosed in /privacy §4. |
| **Backups** (`pg_dump` → S3) | `northsign-backups` | **14 daily + 4 weekly** (Phase 3 configuration) | Rolling expiry: a record deleted in production is gone from backups within ≤ 7 weeks. |
| Analytics events | PostHog (if enabled) | Per PostHog project settings; pseudonymous | No document content. |

## 3. Backups

Phase 3 runbook keeps **14 daily and 4 weekly** `pg_dump` archives in
`northsign-backups` (ca-central-1). Restoration drill: `RESTORE.md`.
Backups are inside the residency claim; restore of a single deleted record
from backup is manual and only performed for legal holds.

## 4. What we never collect

- No payment-card data (Stripe deferred to Phase 6 and never stored by us).
- No advertising or cross-site tracking identifiers; no ad cookies.
- No document *content* beyond what the service needs to render, sign, and
  evidence the signing (we do not mine documents for analytics).
- No precise geolocation; IP addresses are collected only for the audit
  trail, security logs, and abuse prevention, as disclosed in /privacy.
- No special-category information beyond what users choose to place in
  document fields themselves.

## 5. Known deferred work

- **Pruning jobs** for `UserSecurityAuditLog` (12 mo), `WebhookCall` (90 d),
  `RateLimit` (30 d), `BackgroundJob` (90 d), consent records (3 y post
  deletion) are documented here but **not yet implemented** — a scheduled
  pruning job is tracked as a launch-gate follow-up in PHASES.md.
- Stripe-related retention (receipts, billing data) will be added when
  Phase 6 lands.
