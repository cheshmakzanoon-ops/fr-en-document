# PRIVACY-OPS — Data Subject Request (DSAR) Manual Process

> **Phase 5, Step 4.** Operational runbook for handling privacy requests.
> **DRAFT — requires review by a Canadian lawyer before public launch.**
> Companion docs: `COMPLIANCE.md` (inventory), `RETENTION.md`,
> `INCIDENT-RESPONSE.md`, `/privacy` (public policy).

---

## 1. Channels

| Channel | Address | Notes |
|---|---|---|
| Privacy intake (primary) | **privacy@northsign.ca** | Monitored by the privacy officer. Named in /privacy and email footers. |
| Self-serve (access/portability) | In-app: **Settings → Profile → Download data export** | Instant JSON archive: profile, consents, security log, owned documents (metadata + recipients). This satisfies most access/portability requests without manual work. |
| General support | support@northsign.ca | Anything privacy-related received here is forwarded to the privacy inbox same-day. |

## 2. Request lifecycle

1. **Intake (day 0).** Log the request in the register (§4) with a sequential ID (`DSAR-YYYY-NNN`), the date, channel, request type, and requester contact.
2. **Identity verification (before any disclosure).** Minimum standard:
   - Request comes from, or is confirmed by, the email address on the account; **and**
   - For account holders: a login to the account, or a signed statement matching known profile details.
   - For document recipients (no account): the document token/reference from their email, plus one corroborating detail (sender name or approximate date).
   - If in doubt, ask for one more identifier — never release data without reasonable assurance. Escalated requests (large scope, third-party disputes) may require government ID handled per the lawyer-review note below.
3. **Scope clarification (if needed).** Ask what data/period the request covers. Do not stall the 30-day clock on clarification: respond with what is unambiguous, continue the rest.
4. **Fulfilment.**
   - Access / portability → run the in-app export for the account (or query the tables listed in `COMPLIANCE.md` §1 for non-account subjects) and deliver in a structured, machine-readable format.
   - Rectification → profile fields are self-serve in the app; assist otherwise. Audit-log *evidence* entries are not rewritten — corrections are appended as annotations.
   - De-indexing / de-referencing (Law 25 s. 29) → we operate no public search index of personal information. The only public exposure is document share links and signing links; handling is per-case (disable the share link via admin tooling).
   - Consent withdrawal (marketing) → record the withdrawal and stop any future mailings. Rows are append-only; the withdrawal row supersedes.
   - Deletion → run the account deletion path (Settings → Profile → Delete Account). Behavior is defined in `DECISIONS.md` D-026: pending/completed documents are **orphaned to the deleted-account service account, not destroyed**; drafts/templates are hard-deleted; documents in other owners' teams are transferred to that owner.
5. **Response (≤ 30 days).** Reply in writing (email) describing what was done and how. The 30-day clock runs from intake, not from verification completion — so verify promptly. An extension for complexity is permitted but must be communicated within the 30 days with a reason and a date.
6. **Closure.** Update the register row with outcome, fulfilment date, and any notes. Retain DSAR records themselves for accountability (2 years).

## 3. Refusal ground rules

- A request may be refused (fully or partly) only where permitted by law — e.g. the information is protected by solicitor-client privilege, its disclosure would reveal another individual's personal information (redact instead of refuse), or legal retention obligations (evidentiary audit trails for signed documents) apply.
- Every refusal must be justified in writing, cite the reason, and inform the requester of their right to complain to the OPC (PIPEDA) or CAI (Law 25).
- Signed documents are legal records: deletion requests from *senders* do not destroy documents other parties rely on (D-026). Explain the retention rationale and the export option.

## 4. Request log template

Keep this register (a spreadsheet or this file, one row per request):

| Field | Example |
|---|---|
| Request ID | DSAR-2026-001 |
| Received | 2026-09-15 |
| Channel | privacy@ / in-app / support@ |
| Requester name / email | j…@example.com |
| Type | access / portability / rectification / de-indexing / withdrawal / deletion / complaint |
| Identity verified | method + date |
| Scope | "All data" / specific documents |
| 30-day deadline | 2026-10-15 |
| Fulfilled / Refused / Extended | 2026-10-02 — export delivered |
| Notes | co-signer records retained per D-026 |
| Closed by | [privacy officer initials] |

## 5. Roles

- **Privacy officer (all DSAR decisions):** the operator, until otherwise designated. Named in `INCIDENT-RESPONSE.md`.
- **Developer support:** required for data in systems without self-serve access (S3 objects, backup archives, email logs).

## 6. Privacy impact assessment (Law 25 s. 3.3) checklist

For every new project/feature involving personal information, record answers in `DECISIONS.md` before build:

1. What personal information is collected, and is it the minimum necessary?
2. Purposes — are they specified, documented, and disclosed in /privacy?
3. Where does the data rest (region) and which processors touch it?
4. Who inside the organisation can access it, and how is access logged?
5. What is the retention period, and what deletes it?
6. What are the confidentiality risks, and what mitigations apply?
7. Does it involve automated decision-making with legal effects, cross-border transfer, or sensitive information? (If yes → lawyer review before launch.)
