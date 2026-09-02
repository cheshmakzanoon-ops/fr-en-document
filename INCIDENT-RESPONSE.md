# INCIDENT-RESPONSE — Confidentiality Incident Plan

> **Phase 5, Step 5.** What counts as a confidentiality incident, how it is
> registered, and the notification thresholds and clocks for the Commission
> d'accès à l'information (Québec, Law 25) and the Office of the Privacy
> Commissioner of Canada (PIPEDA). **DRAFT — requires review by a Canadian
> lawyer before public launch.** Companion: `COMPLIANCE.md`, `RETENTION.md`,
> `PRIVACY-OPS.md`, `SECURITY.md`.

---

## 1. What counts as a confidentiality incident

Any **unauthorized access to, use, disclosure, loss, or destruction** of
personal information held by NorthSign — including any exposure of documents,
recipient information, account data, or audit trails. Examples in our context:

- Unauthorized access to the application VM, database, or S3 buckets.
- Exposure of signed documents or signing links beyond intended recipients
  (e.g. share-link leak, misdirected email).
- Compromise of an account that grants access to documents.
- A successful exploit in the application (RCE, auth bypass) touching
  personal-information stores — even if no data is confirmed taken
  ("real risk" is assessed on exposure, not proven exfiltration).
- Ransomware or destructive loss of records.

Out of scope: attempts blocked by controls with no exposure, pure
availability blips without data impact.

## 2. Roles

| Role | Who | Responsibility |
|---|---|---|
| **Privacy officer** | **The operator** (you), until otherwise designated | Owns the register, risk-of-harm assessment, all notifications to CAI/OPC/individuals, and public statements. |
| Incident lead (technical) | Operator or on-call developer | Containment, evidence preservation, forensics, remediation. |
| Legal counsel | Retained counsel (Phase 10 launch gate) | Review of notifications; privileged advice. |

There is currently no separate on-call rotation: the operator is the single
escalation point. Designate a backup before public launch.

## 3. Response phases

1. **Detect & contain (immediately).** Revoke sessions/keys, block access,
   snapshot logs for evidence before remediation destroys them.
2. **Assess (without delay).** What data, whose data, how exposed, is it
   recoverable, is the vector closed. Document findings in the register.
3. **Notify (per §4 thresholds).**
4. **Remediate & record.** Fix root cause; record lessons in the register.

## 4. Notification thresholds and clocks

### 4.1 Québec — CAI (Law 25)

| Trigger | Clock |
|---|---|
| Any confidentiality incident involving personal information — **register it** (Law 25 s. 3.5 register requirement) | **Immediately** upon confirming the incident |
| Incident presents a **risk of serious harm** to an individual | Notify **CAI as soon as possible** (practically: within days, not weeks) |
| Risk of serious harm to individuals — or notification helps reduce that risk | Notify **affected individuals** with prescribed content (what happened, data involved, mitigations, contact) |

### 4.2 Canada — OPC (PIPEDA)

| Trigger | Clock |
|---|---|
| Breach of security safeguards creating **"real risk of significant harm" (RROSH)** to an individual | Report to **OPC as soon as feasible**; notify **affected individuals** as soon as feasible. Maintain breach records for **24 months** |

Practical rule adopted by NorthSign: when in doubt between the two regimes,
apply the **stricter** clock and notify both. Québec residents are covered by
Law 25 regardless of where the operator is; PIPEDA applies to our commercial
activities in Canada.

### 4.3 Notification content checklist

- Circumstances and (known) cause; date/time of incident and discovery.
- Categories of personal information involved; number of individuals (estimate).
- Steps taken to reduce the risk of harm (containment, remediation).
- Steps the individual can take (e.g. password change, monitor statements).
- Contact for follow-up: **privacy@northsign.ca**.
- (CAI form) Remediation plan and any third parties involved.

## 5. Breach register template

Keep one row per incident (even non-notifiable ones — Law 25 requires a
register of **all** confidentiality incidents):

| Field | Notes |
|---|---|
| Incident ID | `IR-YYYY-NNN` |
| Detected / Confirmed | dates & times |
| Description | what happened, vector |
| Data involved | categories, individuals affected |
| Risk assessment | serious-harm / RROSH reasoning, decision & rationale |
| Containment / remediation | actions and dates |
| CAI notified? | date, reference # |
| OPC notified? | date, reference # |
| Individuals notified? | date, method, count |
| Closed | date, lessons learned |

## 6. Reporting inside the company

Any suspected incident is reported to **privacy@northsign.ca** immediately;
no employee, contractor, or user attempt to investigate independently. The
security-disclosure channel remains `SECURITY.md` (GitHub Security Advisories).

## 7. Drills

One tabletop exercise per year (calendar entry; first one before the Phase 10
launch gate), walking a document-store compromise through §3–§5 end to end.
