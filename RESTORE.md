# RESTORE — NorthSign backup & restore drill

> Phase 3, Step 6.
>
> **A backup that has never been restored is a wish, not a backup.** Run
> this drill on a throwaway VM at least quarterly and after any major
> schema migration, and record how long it took (target RTO for MVP:
> **under 4 hours**).

---

## 0. What we back up, and how it is recovered

| Data | Mechanism | Recovery |
|---|---|---|
| PostgreSQL (users, docs metadata, envelopes, audit logs) | `scripts/backup.sh` — nightly `pg_dump` (custom) → `s3://northsign-backups/northsign-postgres/YYYY-MM-DD.dump`; retention 14 daily + 4 weekly | This document, Sec. 2 |
| Document PDFs (S3) | **Versioning enabled** on `northsign-documents`; the app only overwrites/deletes via versioned writes | This document, Sec. 3 |
| Signing certificate `.p12` + passphrase | File on the VM + passphrase in `.env` | Copy both off-VM at provisioning time (scp) |
| Encryption keys (`NEXT_PRIVATE_ENCRYPTION_KEY*`, `NEXTAUTH_SECRET`) | In the VM's `.env` | Keep an encrypted off-VM copy — **lost keys = unreadable data** |

---

## 1. Restore prerequisites

- The same application image the running system uses
  (`docker/production/Dockerfile` at the deployed commit — check `git log -1`
  on the source VM or the deployed release tag).
- A copy of the VM's `.env` (all secrets: DB, S3, SES, encryption keys,
  signing passphrase).
- The `.p12` signing certificate.
- AWS CLI + `northsign-backup` profile on the machine doing the restore
  (or run the `aws` commands from the new VM).
- DNS control to repoint `app.northsign.ca` (runbook 03).

---

## 2. Full restore drill (fresh VM)

> Commands run on the NEW VM, as the deploy user. `$VM_IP` below is the new
> VM's public IP; the A record is repointed in step 9.

**1. Provision the VM (runbook 04):** Ubuntu 24.04, deploy user in the
docker group, docker + compose plugin, timezone, swap. Install aws CLI v2.

**2. Clone the app at the deployed commit:**

```bash
git clone git@github.com:<org>/northsign.git northsign
cd northsign
git checkout <deployed-release-tag-or-commit>
```

**3. Restore the configuration:**

```bash
cp .env.production.example .env
# paste the REAL values from the original VM's .env (scp'd copy)
chmod 600 .env
# also copy the signing certificate:
mkdir -p . && cp /path/to/cert.p12 ./cert.p12
```

**4. Pull the newest database dump:**

```bash
aws s3 ls s3://northsign-backups/northsign-postgres/ \
  --profile northsign-backup --region ca-central-1
# pick the newest YYYY-MM-DD.dump, then:
aws s3 cp s3://northsign-backups/northsign-postgres/<NEWEST>.dump \
  /tmp/restore.dump --profile northsign-backup --region ca-central-1
```

**5. Start only the database** (the app is still down):

```bash
docker compose -f docker-compose.prod.yml up -d database
docker compose -f docker-compose.prod.yml ps database   # wait for (healthy)
```

**6. Restore the dump (custom format, from stdin):**

```bash
docker compose -f docker-compose.prod.yml exec -T database \
  pg_restore --clean --if-exists --no-owner \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom - \
  < /tmp/restore.dump
```

**7. Verify the data is really there** (this is the point of the drill):

```bash
docker compose -f docker-compose.prod.yml exec -T database psql \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c \
  "select count(*) as users from \"User\";"
docker compose -f docker-compose.prod.yml exec -T database psql \
  --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" -c \
  "select count(*) as documents from \"Document\";"
# compare with the numbers recorded on the source VM before the drill
```

If the counts do not match the source, STOP and investigate (dump file,
credentials, db name mismatch). Do not continue the drill on a wrong base.

**8. Start the rest of the stack** (migrations run automatically on app
boot via `start.sh` → `prisma migrate deploy`; the restored schema is at
the backup's version, and any newer migrations apply forward):

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 app
curl -fsS http://127.0.0.1:3000/api/health   # {"status":"ok"}
```

**9. Repoint DNS:** change `app.northsign.ca` A record to the new VM's IP
(runbook 03). TTL is 300s, so the cutover is quick. Verify:

```bash
dig @8.8.8.8 +short A app.northsign.ca   # expect the NEW IP
curl -fsS https://app.northsign.ca/api/health
```

**10. Smoke test (the restore drill's exit criteria):**

- [ ] Sign in as an existing user (credentials from the backup).
- [ ] Open a previously-signed document → download the signed PDF (S3 read).
- [ ] Upload a new document → confirm the object appears in
      `northsign-documents` (S3 write).
- [ ] Trigger a signing flow → email is sent (SES read/write works).
- [ ] `docker compose logs app` shows no errors.
- [ ] Backup cron is still scheduled on the new VM
      (`crontab -l` → `scripts/backup.sh`).

**11. Clean up:** the old VM's public IP can be released once DNS TTLs have
fully expired (check `dig` from multiple resolvers) and you are confident
the new VM is healthy.

---

## 3. Document recovery (S3 versioning)

The app references documents by S3 key. Versioning on `northsign-documents`
means an accidental overwrite or delete (a delete marker) is recoverable
**without** touching the database.

**Find the versions of a key:**

```bash
aws s3api list-object-versions --bucket northsign-documents \
  --prefix "<object-key>" --region ca-central-1 --profile northsign-app
```

**Restore a specific version over the same key** (so the database reference
keeps working):

```bash
aws s3api get-object --bucket northsign-documents \
  --key "<object-key>" --version-id "<VersionId>" /tmp/recovered.pdf \
  --region ca-central-1 --profile northsign-app

aws s3api put-object --bucket northsign-documents \
  --key "<object-key>" --body /tmp/recovered.pdf \
  --region ca-central-1 --profile northsign-app
```

Or in the console: bucket → object → **Show versions** → select the version
→ **Download**, then re-upload to the same key.

Notes:

- Deleting the **delete marker** is the cleanest way to undo a delete:
  `aws s3api delete-object --bucket northsign-documents --key "<key>" --version-id "<delete-marker-version-id>"`.
- If the database itself was lost, restore Sec. 2 first, then use Sec. 3 to
  re-upload any objects that were lost between the last dump and the
  incident (the DB holds the keys; S3 holds the bytes — together they are
  the full document store).

---

## 4. Restore-drill checklist (quarterly)

- [ ] Timed run of Sec. 2 on a throwaway VM — record start/end time.
- [ ] Row counts in step 7 match the source.
- [ ] Signed-PDF download + fresh upload work.
- [ ] `.env` and `cert.p12` copies are retrievable from wherever they are
      stored off-VM (test the retrieval path, not just the storage).
- [ ] DNS repoint was exercised end-to-end.
- [ ] Restore duration written into DEPLOYMENT.md's cost/ops notes or the
      phase handoff.
