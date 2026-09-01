# Runbook 02 — Email (AWS SES, ca-central-1)

> Phase 3, Step 4. Wires NorthSign's transactional email to **Amazon SES in
> ca-central-1 (Montreal)** — the same region as everything else, so the
> residency claim holds for the sending stack too.
>
> Sender identity: **`no-reply@mail.northsign.ca`** (subdomain, deliberately
> not the apex). All mail is outbound; **no MX records are needed** (we do
> not receive email).

**Prerequisites**

- `aws` CLI v2, region pinned to `ca-central-1` (or the SES console in the
  **Canada (Central)** region — make sure the region selector in the console
  shows `ca-central-1` before doing anything).
- DNS control over `northsign.ca` (see runbook 03 for the full records
  table). DNS changes usually propagate within minutes to a couple of hours.

---

## 1. Verify the domain in SES

SES must verify that we control `northsign.ca`. Verifying the **apex**
covers every subdomain, so `no-reply@mail.northsign.ca` is usable with one
identity (AWS: Easy DKIM settings for a verified domain apply to all
subdomains of that domain).

**Console:** SES → Identities → Create identity → **Domain** →
`northsign.ca` → Easy DKIM enabled (default) → Create.

**Or CLI:**

```bash
aws sesv2 create-email-identity \
  --email-identity northsign.ca \
  --region ca-central-1
```

The identity starts in `PENDING` state until the DNS records below verify.

## 2. Publish the DKIM CNAME records

Easy DKIM generates **3 CNAME records**. Copy them from the identity detail
page (Identities → northsign.ca → **Publish DNS records**), then publish
them on `northsign.ca` (record type `CNAME`):

| Record name (Host) | Value (Points to) | Notes |
|---|---|---|
| `<TOKEN1>._domainkey.northsign.ca` | `<TOKEN1>.dkim.amazonses.com` | from SES console |
| `<TOKEN2>._domainkey.northsign.ca` | `<TOKEN2>.dkim.amazonses.com` | from SES console |
| `<TOKEN3>._domainkey.northsign.ca` | `<TOKEN3>.dkim.amazonses.com` | from SES console |

`<TOKEN1..3>` are the per-identity tokens shown in the console — they are
unique to this account and are *not* in this repo (never commit them).

## 3. SPF (TXT on apex `northsign.ca`)

```dns
v=spf1 include:amazonses.com ~all
```

- One SPF record per domain only. If `northsign.ca` already has an SPF
  record (e.g. from a mail provider), merge the mechanism instead of
  adding a second record.
- `~all` (softfail) is the AWS-recommended default for senders that share
  the domain; `-all` is stricter but can break legitimate senders — do not
  use `-all` until you are certain no other service sends from the domain.

## 4. DMARC (TXT on apex `northsign.ca`)

```dns
v=DMARC1; p=quarantine; rua=mailto:rufo@northsign.ca; ruf=mailto:rufo@northsign.ca; adkim=s; aspf=s; pct=100
```

- **`p=quarantine` to start** — reports first, enforcement later. After a
  few weeks of clean reports you may tighten to `p=reject`.
- `rufo@northsign.ca` is the **placeholder** report inbox (the address is
  intentionally not used for sending). Create that mailbox before launch so
  DMARC aggregate/forensic reports are actually read. (`rua` = aggregate,
  `ruf` = forensic.)

## 5. Wait for verification

Back in SES → Identities → `northsign.ca`: the identity status becomes
**Verified** and the three DKIM records show **Success**. Do not continue
until the DNS records show success — mail will otherwise fail SPF/DKIM and
bounce in the sandbox.

## 6. Generate SES SMTP credentials

The app sends through the **SES SMTP interface** (standard SMTP + STARTTLS)
using nodemailer's `smtp-auth` transport — which already exists in the
codebase, so **no application change is needed**.

**Console:** SES → Account dashboard → SMTP settings → **Create SMTP
credentials** → name e.g. `northsign-smtp`. This creates an IAM user
(`ses-smtp-user-*`) scoped to SES send, and shows:

- **SMTP username**
- **SMTP password** — displayed **once**; store it in the VM's `.env`
  immediately (`NEXT_PRIVATE_SMTP_USERNAME` / `NEXT_PRIVATE_SMTP_PASSWORD`).

These are **not** the `northsign-app` S3 keys from runbook 01.

## 7. Request production access (exit the sandbox)

New SES accounts start in the **sandbox**: sending is limited to verified
addresses and to 200 messages/24h. Exit it:

**Console:** SES → Account dashboard → **Request production access** →
complete the form (use case: transactional — signing notifications for a
SaaS product; mail type: transactional; confirm the AWS Service Terms and
anti-spam policy) → Submit. Approval is usually within hours, occasionally
a day.

**Or CLI (needs the same details):**

```bash
aws sesv2 put-account-details \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url https://app.northsign.ca \
  --use-case-description "Transactional notification emails for NorthSign e-signature service (document signed, needs attention, etc.)" \
  --contact-language EN \
  --region ca-central-1
```

**Before approval:** test with the SES sandbox by sending to your own
verified address (`aws sesv2 send-email`, or in-app with a test account).
**After approval:** sending limits default to 50,000/day (enough for MVP);
raise later if needed.

## 8. App configuration (exact values)

Add to the VM's `.env` (already templated in the production configuration
template — copy/fill values):

| Variable | Value | Why |
|---|---|---|
| `NEXT_PRIVATE_SMTP_TRANSPORT` | `smtp-auth` | SES SMTP interface |
| `NEXT_PRIVATE_SMTP_HOST` | `email-smtp.ca-central-1.amazonaws.com` | SES SMTP endpoint for ca-central-1 |
| `NEXT_PRIVATE_SMTP_PORT` | `587` | STARTTLS port |
| `NEXT_PRIVATE_SMTP_SECURE` | *(empty)* | 587 uses STARTTLS, not implicit TLS |
| `NEXT_PRIVATE_SMTP_UNSAFE_IGNORE_TLS` | *(empty)* | never disable TLS |
| `NEXT_PRIVATE_SMTP_USERNAME` | SMTP username from Step 6 | |
| `NEXT_PRIVATE_SMTP_PASSWORD` | SMTP password from Step 6 | |
| `NEXT_PRIVATE_SMTP_FROM_NAME` | `NorthSign` | brand (overrides code default) |
| `NEXT_PRIVATE_SMTP_FROM_ADDRESS` | `no-reply@mail.northsign.ca` | subdomain sender |

**Why the subdomain?** `no-reply@mail.northsign.ca` keeps the apex clean
for the marketing domain and future human mail (`hello@northsign.ca`), and
keeps bulk/signature mail isolated from any future newsletter sending —
which protects the domain reputation and DMARC posture.

**Nodemailer check:** the `smtp-auth` transport in
`packages/lib/server-only/email/` builds a standard nodemailer transport
from these variables. SES SMTP is plain SMTP + STARTTLS, so **no code
change was required** (verified against the transport config schema:
host/port/secure/username/password/service — all present).

## 9. Test

```bash
# From any machine with AWS creds + SES production access:
aws sesv2 send-email \
  --region ca-central-1 \
  --from-email-address no-reply@mail.northsign.ca \
  --destination ToAddresses=you@example.com \
  --content Subject={Data="NorthSign SES test",Charset="UTF-8"},Body={Text={Data="If you read this, SES works from ca-central-1.",Charset="UTF-8"}}
```

Then the real test is in the app (DEPLOY.md smoke test): sign up → the
welcome/verification email arrives from `no-reply@mail.northsign.ca` with
DKIM `pass` (check the raw headers).

## Notes & gotchas

- **EC2 port 25 throttle** does not matter — we connect out on 587.
- If the app container cannot reach SES (timeouts), check the VM's security
  group/ufw egress (outbound 587 must be allowed; default allow is fine).
- SES stores send records/suppression lists in the region the identity was
  created — ca-central-1. The suppression list is **enabled by default**:
  bounces/complaints are tracked there and the app's SMTP user inherits
  that behavior (good — do not disable).
- Deliverability: new domains start "cold". Keep send volume low and steady
  for the first weeks, watch the DMARC reports, and verify the app sends
  only transactional mail (it does — no marketing list).
