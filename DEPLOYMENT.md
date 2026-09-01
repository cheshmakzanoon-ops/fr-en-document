# DEPLOYMENT — NorthSign Production Architecture & Data Residency

> Phase 3, Step 1. This is the authoritative architecture document for the
> NorthSign production environment. It fixes the **data-residency claim** that
> marketing and legal will reuse verbatim, so every component below is labeled
> with its hosting region and anything that is NOT in Canada is called out
> explicitly.
>
> Companion documents: `DEPLOY.md` (first-deploy runbook), `RESTORE.md`
> (restore drill), `docs/runbooks/*` (S3, SES, DNS, VM hardening, monitoring),
> `PHASES.md` / `DECISIONS.md` (plan + decisions D-017+).

---

## 1. Residency claim (exact wording)

> **NorthSign keeps data at rest and document processing in AWS
> ca-central-1, Montreal.**

That sentence is the product claim. Scope of the claim (what it covers):

| Surface | Where it lives | Region |
|---|---|---|
| PostgreSQL database (users, documents metadata, envelopes, audit logs) | Postgres 16 container on the application VM (EC2) | ca-central-1 (Montreal) |
| Document files (uploaded PDFs + signed PDFs) | S3 bucket `northsign-documents` (versioning on) | ca-central-1 (Montreal) |
| Database backups (`pg_dump` custom format) | S3 bucket `northsign-backups` | ca-central-1 (Montreal) |
| Application processing (PDF signing, audit log rendering, API) | NorthSign container on the application VM (EC2) | ca-central-1 (Montreal) |
| Signing certificate (`.p12`, local transport) | Mounted read-only into the app container from the VM | ca-central-1 (Montreal) |
| Outbound transactional email | AWS SES **Simple Email Service**, region ca-central-1 | ca-central-1 (Montreal) |

The claim covers **data at rest** (database, document objects, backups) and
**document processing** (everything that runs in the app container: signing,
certificate rendering, audit logs, conversion). It does not cover transit —
see Sec. 4 for the precise exclusions.

---

## 2. Component diagram

```
                         Internet
                            │
                            ▼
                 ┌──────────────────────┐
                 │   DNS (northsign.ca) │   Cloudflare or registrar
                 │  app.northsign.ca ───┼──► A record → VM public IP
                 └──────────────────────┘        (see runbook 03-dns)
                            │ :443 / :80
                            ▼
        ┌───────────────────────────────────────────────────────┐
        │  VM — EC2 in ca-central-1 (Montreal)                  │
        │  Ubuntu 24.04 LTS, ufw: 22/80/443, Docker            │
        │                                                       │
        │   ┌─────────────────────────────────────────────┐     │
        │   │  caddy:2-alpine   (reverse proxy, TLS)      │     │
        │   │  ports 80/443, Let's Encrypt auto-TLS      │     │
        │   │  app.northsign.ca → http://app:3000         │     │
        │   └───────────────────┬─────────────────────────┘     │
        │                       │ http://app:3000                │
        │   ┌───────────────────▼─────────────────────────┐     │
        │   │  app — NorthSign (node:22-alpine, non-root) │     │
        │   │  Hono + React Router v7 · Prisma · jobs=local│     │
        │   │  /api/health  /api/auth  /api/trpc  ...      │     │
        │   └─────────┬──────────────────┬────────────────┘     │
        │             │                  │                      │
        │   ┌─────────▼────────┐  ┌──────▼─────────────────┐   │
        │   │ postgres:16       │  │ .p12 signing cert      │   │
        │   │ (data volume,     │  │ (read-only mount)      │   │
        │   │  on-VM disk)      │  └────────────────────────┘   │
        │   └───────────────────┘                               │
        └──────────┬───────────────────────────┬────────────────┘
                   │                           │
        ┌──────────▼──────────────┐  ┌─────────▼────────────────┐
        │ S3 — ca-central-1       │  │ SES — ca-central-1       │
        │ northsign-documents     │  │ SMTP interface 587/TLS   │
        │  (versioned, private)   │  │ no-reply@mail.northsign.ca│
        │ northsign-backups       │  └──────────────────────────┘
        │  (pg_dump nightly)      │
        └─────────────────────────┘
```

Notes:

- The VM, both S3 buckets, and SES all sit in **AWS ca-central-1 (Montreal)**.
- The app uploads documents **directly to S3** via presigned POST URLs
  (`NEXT_PUBLIC_UPLOAD_TRANSPORT=s3`), so document bytes never transit an
  intermediate service; PDF signing happens in the app container on the VM.
- Postgres runs **on the VM** (not RDS) — decision rationale in D-018.
  The data volume lives on the VM's EBS root volume, which is
  region-pinned to ca-central-1 by construction.
- Caddy terminates TLS and proxies only to the app; the app is not exposed
  on a public port (compose `expose: 3000` only).
- Jobs are **local** (`NEXT_PRIVATE_JOBS_PROVIDER=local`) — no external
  queue, no Redis; cron-like work runs inside the app process. The nightly
  backup is a VM cron job (see `scripts/backup.sh`).

---

## 3. Component/region table

| # | Component | Technology | Region | Data stored? |
|---|---|---|---|---|
| 1 | App (API + SSR + signing) | Node 22, Hono, React Router v7 | ca-central-1 | session/encryption keys in env; PDFs in S3 |
| 2 | Database | PostgreSQL 16 (container) | ca-central-1 | yes — all relational data |
| 3 | Documents object store | S3 `northsign-documents`, versioned | ca-central-1 | yes — PDFs |
| 4 | Backups object store | S3 `northsign-backups` | ca-central-1 | yes — nightly dumps |
| 5 | Email (outbound) | SES SMTP interface | ca-central-1 | no (transit) |
| 6 | TLS / reverse proxy | Caddy + Let's Encrypt | ca-central-1 (process); certs public CAs | no |
| 7 | DNS | Cloudflare or registrar | global (metadata only) | no |
| 8 | Signing certificate | local `.p12` on VM | ca-central-1 | yes (key material) |
| 9 | Uptime monitoring | UptimeRobot (free) | global (outbound HTTP check only) | no |

---

## 4. What is NOT in Canada — and why

Being precise here is what makes the claim defensible:

1. **DNS zone (northsign.ca)** — hosted at Cloudflare or the registrar.
   Contains only routing configuration (A/CNAME/TXT records), never customer
   data. DNS must be resolvable globally by design.
2. **Outbound email transit** — messages sent through SES necessarily travel
   over the public internet to recipient mail servers (Gmail, Outlook,
   corporate MX, …) that may be anywhere. The claim is about where our
   storage and processing happen, not the transit path; the SMTP connection
   itself originates from SES ca-central-1. No message content is stored by
   NorthSign outside Canada (SES keeps suppression lists and send records in
   the region the identity was created — ca-central-1).
3. **UptimeRobot monitoring** — sends an unauthenticated `GET /api/health`
   from outside; receives `{"status":"ok"}`. No PII, no document data.
4. **Source code hosting (GitHub)** — the repo, not customer data; AGPL-3.0
   requires public source disclosure anyway.
5. **Client-side third-party content** — the app loads no external CDNs for
   customer content; fonts/assets are self-hosted. Any future dependency
   (analytics, AI, payments, …) MUST clear the "Canadian region" rule below.

**The architecture rule (non-negotiable):** every runtime component must be
hostable in AWS ca-central-1. Any proposed dependency without a Canadian
region is flagged for swap before it enters production. This is decision
D-017 in `DECISIONS.md`.

---

## 5. Data flows (how the claim is actually true)

1. **Upload** — the app returns a presigned S3 POST URL for
   `northsign-documents` (ca-central-1); the browser PUTs the PDF directly
   to S3. Object keys are namespaced per user (`<userId>/<id>/<slug>.pdf`).
2. **Signing** — when a recipient signs, the app reads the PDF from S3 into
   the container on the VM, applies the signature with the local `.p12`
   certificate, and writes the signed PDF back to S3. All processing occurs
   in ca-central-1.
3. **Download** — a presigned GET URL is generated; the browser downloads
   from S3 (ca-central-1). Optionally CloudFront later, which would require
   a Canadian-edge note — deferred, not needed for MVP.
4. **Email** — the app sends via nodemailer SMTP (`smtp-auth`) to
   SES ca-central-1 (`email-smtp.ca-central-1.amazonaws.com:587`, STARTTLS);
   SES relays out. Sender: `no-reply@mail.northsign.ca`.
5. **Backups** — nightly `pg_dump` (custom format) on the VM is uploaded to
   `northsign-backups` with a date-stamped key. Documents are protected by
   S3 versioning on the documents bucket (see `scripts/backup.sh` and
   `RESTORE.md`).

---

## 6. Environment configuration

Every production variable, with a comment explaining where its value comes
from, is in **`.env.production.example`**. On the VM it is copied to
`.env` (chmod 600) and injected via `docker-compose.prod.yml`
(`env_file: .env`). Never commit real values — the file in git is a
template only (D-005).

Key production values:

| Var | Production value | Origin |
|---|---|---|
| `NEXT_PUBLIC_WEBAPP_URL` | `https://app.northsign.ca` | DNS + Caddy |
| `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` | `http://app:3000` | compose service name |
| `NEXT_PUBLIC_UPLOAD_TRANSPORT` | `s3` | S3 bucket (runbook 01) |
| `NEXT_PRIVATE_UPLOAD_REGION` | `ca-central-1` | region pinning |
| `NEXT_PRIVATE_SMTP_HOST` | `email-smtp.ca-central-1.amazonaws.com` | SES (runbook 02) |
| `NEXT_PRIVATE_SMTP_FROM_ADDRESS` | `no-reply@mail.northsign.ca` | brand + SES identity |
| `NEXT_PRIVATE_JOBS_PROVIDER` | `local` | no external queue |

---

## 7. Runbook index (Phase 3)

| Doc | Covers |
|---|---|
| `docs/runbooks/01-storage-s3.md` | S3 buckets, IAM least-privilege, transport env (Step 3) |
| `docs/runbooks/02-email-ses.md` | SES verification, DKIM/SPF/DMARC, SMTP creds, sandbox exit (Step 4) |
| `docs/runbooks/03-dns.md` | northsign.ca records table, Cloudflare + registrar (Step 5) |
| `RESTORE.md` | full restore drill + document recovery (Step 6) |
| `docs/runbooks/04-vm-hardening.md` | Ubuntu 24.04 hardening baseline (Step 7) |
| `DEPLOY.md` | first deploy sequence + smoke test checklist (Step 8) |
| `docs/runbooks/05-monitoring.md` | UptimeRobot, container logs, weekly disk check (Step 9) |

Execution order for the operator is in the Phase 3 handoff report
(`PHASES.md` → Phase 3 section and the session handoff).
