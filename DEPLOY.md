# DEPLOY — NorthSign first-deploy runbook

> Phase 3, Step 8. The exact first-deploy sequence, from a fresh, hardened
> VM (runbook 04) to a live `https://app.northsign.ca`. Also the post-deploy
> smoke test checklist. A backup that was never restored is a wish — same
> applies to a deploy that was never smoke-tested; **do not skip Sec. 6**.

**Before you start, everything below must already exist:**

- [ ] AWS account, buckets + IAM users created (runbook 01)
- [ ] SES domain verified + production access granted (runbook 02)
- [ ] DNS records published and resolving (runbook 03)
- [ ] VM hardened (runbook 04)
- [ ] `.p12` signing certificate generated per `SIGNING.md` and copied to the VM
- [ ] `.env` filled from the production configuration template

---

## 1. Clone and configure (on the VM, as `northsign`)

```bash
cd ~
git clone git@github.com:<org>/northsign.git northsign
cd northsign
git checkout dev          # or the release tag you are deploying

cp .env.production.example .env
# edit .env — fill every CHANGE_ME (see comments; each value's origin is in
# the template and in runbooks 01–03)
chmod 600 .env

# signing certificate (generated per SIGNING.md):
cp ~/cert.p12 ./cert.p12
chmod 600 ./cert.p12
```

## 2. Verify configuration before starting

```bash
# the URL the app serves:
grep NEXT_PUBLIC_WEBAPP_URL .env          # → https://app.northsign.ca
# the app's own internal URL (compose service name, not localhost):
grep NEXT_PRIVATE_INTERNAL_WEBAPP_URL .env # → http://app:3000
# upload transport:
grep NEXT_PUBLIC_UPLOAD_TRANSPORT .env    # → s3
# SMTP endpoint (must be the ca-central-1 host):
grep NEXT_PRIVATE_SMTP_HOST .env          # → email-smtp.ca-central-1.amazonaws.com
```

## 3. Build and start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds the app image (`docker/production/Dockerfile`), starts
`postgres:16`, waits for it to be healthy, then starts the app.

## 4. Migrations

`docker/start.sh` runs **`prisma migrate deploy` automatically on every app
container start** — you do not need a separate migration step. To run it
manually (e.g. after pulling a newer image without restarting the stack):

```bash
docker compose -f docker-compose.prod.yml exec -T app \
  sh -c 'cd /app/apps/remix && npx prisma migrate deploy --schema ../../packages/prisma/schema.prisma'
```

**Seed guard (production):** the seed script
(`packages/prisma/seed-database.ts`) runs **only** when you explicitly call
`npm run prisma:seed` (or `prisma db seed`). It is never invoked by
`migrate deploy`, by `start.sh`, or by the Docker image — there is no
`seed` step anywhere in the production path. **Do not run it in
production**: it creates demo users/documents. Decision D-020.

## 5. Certificates (Caddy / Let's Encrypt)

Caddy issues certificates automatically on first request — with the caveat
that `app.northsign.ca` must already resolve publicly to this VM (runbook
03 Sec. 4, checked from an external network).

```bash
docker compose -f docker-compose.prod.yml logs -f caddy
# wait for a line like:
#   certificate obtained successfully
# then from your laptop:
curl -fsS https://app.northsign.ca/api/health    # {"status":"ok"}
```

If issuance stalls: DNS propagation (check `dig @8.8.8.8`), or port 80 not
reachable (ufw — runbook 04 Sec. 5).

## 6. Smoke test checklist (first deploy AND every deploy)

Run through the real product flow, not just the health check:

1. **Health:** `curl -fsS https://app.northsign.ca/api/health` → `{"status":"ok"}`.
2. **Sign-up:** create a brand-new account at
   `https://app.northsign.ca/signup` (email + password).
3. **Real email received:** the verification/welcome email arrives at the
   inbox from **`no-reply@mail.northsign.ca`**; check the raw headers show
   `dkim=pass` and `spf=pass` (Gmail → Show original). If it lands in spam,
   stop and check SPF/DKIM before continuing.
4. **Verify email** and sign in.
5. **Upload:** upload a PDF → it is stored in S3:
   ```bash
   aws s3 ls s3://northsign-documents/ --recursive --region ca-central-1 \
     --profile northsign-app | tail -5
   ```
6. **Send:** add a recipient (a second mailbox you control), send the
   envelope → recipient gets the signing email.
7. **Sign:** open the signing link, place a signature, sign → the flow
   completes and the sender sees status "Completed".
8. **Download:** download the signed PDF from the app → opens correctly and
   shows the signature + certificate.
9. **File present in S3:** confirm the signed object exists in
   `northsign-documents` (console or the `aws s3 ls` above), and note its
   key.
10. **Backup runs:** trigger `scripts/backup.sh` once manually and confirm
    a dump appears in `s3://northsign-backups/northsign-postgres/`.
11. **Monitoring:** add the UptimeRobot monitor (runbook 05) and see it
    report UP.

**Any failure in 2–9 → the deploy is NOT done.** Fix the cause (usually an
env value), `docker compose -f docker-compose.prod.yml up -d --build`, and
re-run.

## 7. Post-deploy ops handoff

- Nightly backups start automatically via cron (Step 6 / runbook: script
  header of `scripts/backup.sh`).
- Record the deployed commit in your release notes
  (`git rev-parse --short HEAD` on the VM).
- Quarterly restore drill: `RESTORE.md`.
- Weekly disk check + log review: runbook 05.
- Update `PHASES.md` Phase 3 status and the handoff checklist as items are
  completed.

---

## Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `certificate obtained` never appears | DNS not pointing at this VM | runbook 03 Sec. 4 |
| App starts but `/api/health` 502s from Caddy | App crashed on boot | `docker compose logs app` |
| Signup email never arrives | SES sandbox still active / SPF missing | runbook 02 Sec. 7, Sec. 3 |
| Upload fails | S3 keys wrong or region not ca-central-1 | runbook 01 Sec. 5 |
| Signing fails | `.p12` missing/passphrase mismatch | `SIGNING.md`, env values |
| 500 on login after restore | Encryption keys rotated since backup | restore the ORIGINAL keys (RESTORE.md Sec. 0) |
