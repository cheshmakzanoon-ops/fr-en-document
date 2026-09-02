# COMPLIANCE — NorthSign Compliance Inventory (Phase 5, Step 1)

> **Phase 5, Step 1.** This document maps **what NorthSign actually does today**
> (as discovered in this repo, not as we wish it behaved) against what PIPEDA
> and Quebec Law 25 require. It is the grounding document for every policy
> statement in `/terms`, `/privacy`, `RETENTION.md`, and
> `INCIDENT-RESPONSE.md`. **DRAFT — requires review by a Canadian lawyer
> before public launch.**
>
> Method: schema + code inspection of `packages/prisma/schema.prisma`,
> `packages/lib/server-only/**`, `apps/remix/app/**`, and `DEPLOYMENT.md`
> (Phase 3). Line references are to files as of commit `870d2e0` (Phase 4, Step 8).

---

## 1. Personal information collected & where it lives

### 1.1 Account holders (authenticated users)

| Data | Table.field | Why | Notes |
|---|---|---|---|
| Name | `User.name` | Display on documents/emails | Optional |
| Email | `User.email` (unique) | Auth, notifications, document send | Required |
| Password | `User.password` (bcrypt via `@node-rs/bcrypt`) | Auth | Hashed; legacy column, todo (RR7) to drop |
| Signature image | `User.signature` (base64) | Drawn/uploaded default signature | Personal info (biometric-adjacent) |
| Avatar | `AvatarImage.bytes` via `User.avatarImageId` | Display | Optional |
| 2FA secret + backup codes | `User.twoFactorSecret`, `User.twoFactorBackupCodes` | Security | |
| SSO/OAuth tokens | `Account` rows (`refresh_token`, `access_token`, `id_token`) | Google/Microsoft/OIDC sign-in | Only when SSO used |
| Preferences/metadata | `User.source` (signup source), `User.lastSignedIn` | Ops | `source` is analytics-grade |

### 1.2 Document participants (recipients — usually **not** account holders)

| Data | Table.field | Why | Notes |
|---|---|---|about:blank|
| Email | `Recipient.email` | Receiving signing invitations | Indexed incl. trigram |
| Name | `Recipient.name` | Display on document | Default `""` |
| Signature (typed/drawn/uploaded) | `Signature.typedSignature`, `Signature.signatureImageAsBase64` | Evidence of signing | |
| Field values (text, dates, checkboxes, radio, dropdown, numbers) | `Field.customText`, `Field.fieldMeta` | Document content | Can include arbitrary personal info senders ask for |
| Sign/access auth | `Recipient.authOptions` | e.g. 2FA codes at signing | |
| Interaction state | `Recipient.readStatus`, `signingStatus`, `signedAt`, `sentAt`, `expiresAt`, `lastReminderSentAt`, `nextReminderAt`, `reminderCount` | Audit + reminders | |
| Email locale preference | `Recipient.language` | Personalizes signing emails to the signer's language (Phase 5 Step 6, D-027) | Nullable = inherit document language; sender-set via envelope editor; disclosed in /privacy §1.2 |
| CSC credentials | `CscCredential.certCache`, `serviceTokenCiphertext` | Qualified/eIDAS-style signing (SES) | Encrypted at app layer |

### 1.3 Where personal information leaves the system

| Channel | What goes out | Provider/destination |
|---|---|---|
| Transactional emails (invitations, reminders, completion, rejection, cancellation, password reset, 2FA codes, welcome) | Recipient/user email, names, document titles, signing links (tokens) | AWS SES (ca-central-1); or self-hosted SMTP (`EmailTransport` type SMTP_AUTH/SMTP_API/RESEND/MAILCHANNELS) |
| Webhooks | Document events incl. recipient emails, names, statuses | Customer-configured third-party endpoints (`Webhook.webhookUrl`) |
| PDF documents themselves | Names, signatures, field values, audit-log page | Sent to recipients via email links; downloadable by anyone with the signing/certificate link |
| Support tickets | Name, email, message content | Plain (chat) — `submit-support-ticket.ts` uses `@team-plain/typescript-sdk` |
| Analytics events | Pseudonymous usage events (no doc content) | PostHog (`use-analytics.ts`, `capture-server-event.ts`) — only if configured |
| CAPTCHA | Turnstile token + IP via Cloudflare challenge | Cloudflare Turnstile (`server-only/captcha`) — only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set |
| Error/support inbox | User-initiated support emails | `support@northsign.ca` |
| Logging | Structured app logs may include request metadata (userAgent, ipAddress on audit events) | VM local logs in ca-central-1 |

### 1.4 Data processors actually in the stack (Phase 5 state)

| Processor | Service | Region | Data |
|---|---|---|---|
| AWS | EC2 (app VM), S3 (`northsign-documents`, `northsign-backups`), SES | ca-central-1 (Montreal) | Everything in DEPLOYMENT.md §1 table |
| Plain | `plainClient` (support tickets) | Non-Canadian (US/EU) | Name, email, ticket content — **only if configured** |
| PostHog | Product analytics | US/EU cloud | Pseudonymous events — **only if configured** |
| Cloudflare | Turnstile CAPTCHA | Global edge | Challenge token, IP — **only if configured** |
| Cloudflare or registrar | DNS for northsign.ca | Global | DNS only |
| Stripe | **Planned Phase 6** — not live; `Subscription.customerId` + admin UI exist, no charging path | US | Would process billing name/email |
| SMTP relay (customer-supplied) | Optional `EmailTransport` | Varies | Recipient emails when org configures custom transport |

**No email-forwarding provider is wired today.** The "email forwarding provider"
line in the phase brief refers to future Phase 6+ billing/support flows; it is
listed as *planned, not present*.

---

## 2. Existing audit-log surfaces

Two distinct audit surfaces exist:

### 2.1 `DocumentAuditLog` (per-document, tamper-evident trail rendered into the certificate)

- Fields: `id`, `envelopeId`, `createdAt`, `type`, `data` (JSON), `name`, `email`, `userId`, `userAgent`, `ipAddress`.
- Records: document created/sent/opened/field signed/completed/rejected/deleted, recipient events.
- **Captures signer IP address and user agent** (`extract-request-metadata`) for document events — this is the legally significant evidence trail, rendered into the downloadable signing certificate when the org enables `includeAuditLog`/`includeSigningCertificate`.
- `onDelete: SetNull` on envelope — logs survive envelope deletion (orphaned), keyed only by `envelopeId` string.

### 2.2 `UserSecurityAuditLog` (account security events)

- Types: `SIGN_IN`, `SIGN_IN_FAIL`, `SIGN_IN_2FA_FAIL`, `SIGN_IN_PASSKEY_FAIL`, `SIGN_OUT`, `SESSION_REVOKED`, `PASSWORD_RESET`, `PASSWORD_UPDATE`, `ACCOUNT_PROFILE_UPDATE`, SSO link/unlink, passkey CRUD, 2FA enable/disable.
- Fields: `userId`, `type`, `createdAt`, `userAgent`, `ipAddress`.

Also relevant:

- `Session` rows carry `ipAddress` and `userAgent` per active session.
- `RateLimit` rows key by request identity (`key`, `action`, `bucket`) — pseudonymous counters, retained indefinitely unless pruned.
- `BackgroundJob`/`BackgroundJobTask` store job payloads (can include emails/names) with statuses — not currently TTL-pruned.

## 3. Existing consent capture at signup — **none for ToS/Privacy**

Inspected `apps/remix/app/components/forms/signup.tsx` and
`packages/lib/server-only/user/create-user.ts`:

- The signup form collects name, email, password, signature (+ Turnstile token when configured). **There is no ToS/Privacy acceptance checkbox and no acceptance record.**
- Nothing in `User`, `Account`, or any table stores a terms/privacy version or acceptance timestamp.
- There is no marketing-email opt-in anywhere in the product (good — nothing to unwind; we must keep it that way, i.e. new opt-in must default to **unchecked**).
- SSO paths (`authClient`) also create users without any acceptance record.

**Gap (fixed in Step 3):** PIPEDA consent + Law 25 §8.1 need demonstrable
consent at collection. Migration `20260902xxxxxx_consent_capture` adds
`UserConsentRecord`.

## 4. Existing account deletion path — verified behavior

`packages/lib/server-only/user/delete-user.ts` + `delete-organisation.ts` +
`orphan-envelopes.ts` (all read in full this step):

1. Owner of any organisations → `deleteOrganisation` for each: **orphans every PENDING/REJECTED/COMPLETED envelope** by transferring them to the **deleted-account service account** (`orphanEnvelopes`, sets `deletedAt = now()` — i.e. hidden from lists but retained), then deletes org rows; Stripe subscription cancelled at period end (job).
2. Member of other orgs' teams → their team envelopes are **transferred to the org owner** (`envelope.updateMany userId → orgOwnerId`).
3. `prisma.user.delete` → **hard-deletes the User row**; cascades wipe `Session`, `Account`, `PasswordResetToken`, `Passkey`, `VerificationToken`, `ApiToken`, `Webhook`, `UserSecurityAuditLog`, `Folder`, personal-org remnants, avatar relation (SetNull).
4. Seat-sync jobs fire for orgs the user belonged to.

**What happens to signed documents:** completed/rejected/pending docs the user
owned in their own orgs are **orphaned, not destroyed** — they move to the
service account with `deletedAt` set (hidden from UI, retained for co-signers
and as legal records). Drafts/templates are hard-deleted. Docs in other
people's teams are transferred to the team's org owner. **This is already the
correct "orphan, don't destroy" behavior** required by the phase brief; Step 4
formalizes it and adds export before deletion.

**Gaps:** (a) no pre-deletion data export; (b) `Recipient` rows identifying the
deleted user as a *signer on other people's documents* are **not** touched —
their email+name+signature remain on documents that survive (correct for legal
records, but the deleted user's copy-adjacent artifacts like `User.signature`
are wiped with the cascade); (c) deletion is immediate, no grace period.

## 5. Cookie usage (essential only — no consent banner required)

| Cookie | Source | Purpose | Essential? |
|---|---|---|---|
| `lang` | `storage/lang-cookie.server.ts` | UI locale (2y, httpOnly, secure) | Strictly necessary (user-requested service) |
| theme session cookie | `storage/theme-session.server.ts` | Light/dark preference | Strictly necessary |
| auth/session cookies | `@documenso/auth` (better-auth-based, `packages/auth`) | Authentication | Strictly necessary |
| `preferred-team-url` | `constants/cookies.ts` | Workspace context | Strictly necessary |

No advertising, cross-site tracking, or third-party analytics cookies exist.
PostHog (when enabled) uses `localStorage`-based pseudonymous identifiers, not
ad cookies. **No cookie-consent banner is legally required** for
strictly-necessary cookies under PIPEDA/Law 25; Law 25 transparency about them
is satisfied by the privacy policy.

## 6. Data residency posture (from DEPLOYMENT.md — claim wording is fixed)

> **"NorthSign keeps data at rest and document processing in AWS ca-central-1, Montreal."**

Covers: Postgres DB, S3 document + backup buckets, app processing, signing
cert, SES email region. Does **not** cover transit or the optional third-party
processors in §1.4 above — those are called out explicitly in the finalized
privacy policy.

## 7. Gap list vs PIPEDA fair-information principles & Quebec Law 25

Legend: 🔴 missing, 🟡 partial, 🟢 in place. Actions reference Phase 5 steps.

| # | Principle / requirement | Status | Evidence | Action |
|---|---|---|---|---|
| 1 | **Accountability & designated privacy officer (PIPEDA cl. 4.1)** | 🔴 | No officer designated anywhere in product/docs | Step 2: name officer + `privacy@northsign.ca` in policy; INCIDENT-RESPONSE.md records you as officer |
| 2 | **Identify purposes & limit collection (cl. 4.2, 4.4)** | 🟡 | Collection is documented here but not disclosed to users | Step 2: /privacy states purposes per data category |
| 3 | **Consent — demonstrable at collection (cl. 4.3; Law 25 s. 8.1)** | 🔴 | No ToS/Privacy acceptance stored; no versioning | Step 3: `UserConsentRecord` migration + signup checkbox (required, not pre-checked beyond necessity) |
| 4 | **CASL express consent for marketing email** | 🟢/🔴 | Product sends zero marketing email today; nothing to fix yet | Step 3: opt-in checkbox (unchecked default) + source/timestamp so future marketing is CASL-clean |
| 5 | **Limit use/disclosure/retention (cl. 4.5)** | 🔴 | No retention policy exists; `DocumentAuditLog` orphaned rows, `RateLimit`, `BackgroundJob`, `Session`, `WebhookCall` retained indefinitely | Step 5: RETENTION.md with concrete periods; log-pruning job tracked as deferred item |
| 6 | **Accuracy (cl. 4.6)** | 🟢 | Users edit profile, org names in-app | None |
| 7 | **Safeguards (cl. 4.7)** | 🟢 | TLS, bcrypt, 2FA/passkeys, S3 versioning, VM hardening (Phase 3), app-layer encryption of CSC tokens | Document in privacy policy |
| 8 | **Openness / transparency (cl. 4.8; Law 25 s. 8)** | 🔴 | /terms & /privacy are placeholders ("DRAFT — Phase 5 will finalize") | Step 2: full EN/fr-CA policies with residency claim verbatim |
| 9 | **Individual access (PIPEDA cl. 4.9)** | 🔴 | No "export my data" | Step 4: archive export (profile + documents) |
| 10 | **Law 25 portability (s. 17)** | 🔴 | Same | Step 4: same export (structured, machine-readable) |
| 11 | **Law 25 de-indexing / de-referencing (s. 29)** | 🟡 | No public index of personal data exists to de-index; documents can be hidden from owner UI | Step 2: policy explains scope; manual DSAR process handles requests |
| 12 | **Challenging compliance / complaints channel (cl. 4.10)** | 🔴 | No complaints channel | Step 2+4: privacy@northsign.ca + PRIVACY-OPS.md DSAR intake |
| 13 | **Correction & withdrawal of consent** | 🟡 | Profile editable; deletion path exists but no export and no documented consent-withdrawal semantics | Step 3+4 |
| 14 | **Breach safeguards & register (PIPEDA breach reporting; Law 25 ss. 3.3–3.5)** | 🔴 | No incident register, thresholds, or clocks | Step 5: INCIDENT-RESPONSE.md (CAI 30-day... see doc) |
| 15 | **Automated decision-making transparency (Law 25 ss. 8.1, 12.1)** | 🟢 | No solely-automated decisions with legal effects; AI feature flag exists but off | Policy discloses none in production |
| 16 | **Privacy impact assessment (Law 25 s. 3.3 — new tech/projects)** | 🔴 | Not documented | PIA checklist appended to PRIVACY-OPS.md (Step 4) |
| 17 | **Bilingual (fr-CA) availability of legal information (Charter of the French Language; Law 25 contracts)** | 🔴 | Policies EN-only placeholders | Step 2: both locales from one content source |
| 18 | **Terms of service** | 🔴 | Placeholder | Step 2: full EN/fr-CA terms |

## 8. What Phase 5 deliberately does NOT change

- Signed-document retention semantics (already orphan-on-delete) — formalized, not altered.
- SES processor choice (already ca-central-1).
- Phase 6 Stripe integration (processors list in policy marked accordingly).
- The audit-log IP capture — it is the evidentiary core of the product and is
  disclosed as such in the privacy policy rather than removed.

---

*End of Step 1 inventory. Next: Step 2 legal pages grounded strictly in the
tables above.*
