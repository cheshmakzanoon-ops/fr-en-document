# Runbook 01 — Storage (S3, ca-central-1)

> Phase 3, Step 3. Sets up the two S3 buckets and the least-privilege IAM
> users behind NorthSign's document storage. Everything here runs in
> **AWS ca-central-1 (Montreal)** — the residency line.

**Prerequisites**

- `aws` CLI v2 installed on the machine you operate from
  (`aws --version`).
- An IAM identity with `S3` and `IAM` write permissions for the account
  (admin or a scoped operator role), configured via
  `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
- Region pinned everywhere: `--region ca-central-1`.

---

## 1. Create the buckets

Bucket names must be globally unique across all AWS accounts. If
`northsign-documents` / `northsign-backups` are taken, use a suffixed name
(e.g. `northsign-prod-documents`) and update the app configuration in
§4 accordingly.

```bash
export AWS_REGION=ca-central-1

# Documents (live PDFs)
aws s3api create-bucket \
  --bucket northsign-documents \
  --region ca-central-1 \
  --create-bucket-configuration LocationConstraint=ca-central-1

# Backups (nightly pg_dump)
aws s3api create-bucket \
  --bucket northsign-backups \
  --region ca-central-1 \
  --create-bucket-configuration LocationConstraint=ca-central-1
```

## 2. Block public access (both buckets)

```bash
aws s3api put-public-access-block \
  --bucket northsign-documents \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-public-access-block \
  --bucket northsign-backups \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

There is deliberately no public website hosting, no bucket policy allowing
anonymous access, and no CloudFront at MVP. All reads/writes go through
**presigned URLs** issued by the app.

## 3. Versioning

```bash
# Documents: versioning ON — this is the primary document-recovery mechanism
# (see RESTORE.md §3). Every overwrite/delete becomes a recoverable version.
aws s3api put-bucket-versioning \
  --bucket northsign-documents \
  --versioning-configuration Status=Enabled

# Backups: versioning ON as cheap insurance against a bad pg_dump run.
aws s3api put-bucket-versioning \
  --bucket northsign-backups \
  --versioning-configuration Status=Enabled
```

Optional (recommended before launch): add a lifecycle rule to expire
noncurrent versions of `northsign-documents` after e.g. 365 days to bound
cost. Not required for MVP.

## 4. Least-privilege IAM users

Two IAM users, two narrow inline policies (files are in this repo under
`docs/runbooks/policies/`):

| IAM user | Policy file | Grants |
|---|---|---|
| `northsign-app` | `appuser-policy.json` | documents bucket: Get/Put/Delete objects · backups bucket: PutObject only |
| `northsign-backup` | `backupuser-policy.json` | backups bucket: Get/Put/Delete/List (used by `scripts/backup.sh`) |

```bash
# --- App user (used by the NorthSign app) ---
aws iam create-user --user-name northsign-app
aws iam put-user-policy \
  --user-name northsign-app \
  --policy-name NorthSignAppPolicy \
  --policy-document file://docs/runbooks/policies/appuser-policy.json

# Creates ONE access key pair — capture the SecretAccessKey now (shown once).
aws iam create-access-key --user-name northsign-app
# → NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID / NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY

# --- Backup user (used by scripts/backup.sh on the VM) ---
aws iam create-user --user-name northsign-backup
aws iam put-user-policy \
  --user-name northsign-backup \
  --policy-name NorthSignBackupPolicy \
  --policy-document file://docs/runbooks/policies/backupuser-policy.json

aws iam create-access-key --user-name northsign-backup
# → stored on the VM in ~/.aws/credentials under profile "northsign-backup"
```

**Why two users?** The app never needs to list or delete from the backups
bucket, and the backup script never needs the documents bucket. If one key
leaks, the blast radius stays inside its own bucket.

### Policy contents (versioned in repo)

`docs/runbooks/policies/appuser-policy.json` — replace the bucket ARNs if
you renamed the buckets:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DocumentsReadWriteDelete",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::northsign-documents/*"]
    },
    {
      "Sid": "BackupsPutOnly",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": ["arn:aws:s3:::northsign-backups/*"]
    }
  ]
}
```

`docs/runbooks/policies/backupuser-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BackupsBucketCRUD",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::northsign-backups",
        "arn:aws:s3:::northsign-backups/*"
      ]
    }
  ]
}
```

## 5. Verify the transport works with the app's configuration

The upload transport is implemented in
`packages/lib/universal/upload/providers/s3-provider.ts` (AWS SDK v3). It
reads these variables — **no code change was needed**; real AWS S3 works
with the defaults:

| App variable | Production value | Notes |
|---|---|---|
| `NEXT_PUBLIC_UPLOAD_TRANSPORT` | `s3` | database transport is dev-only |
| `NEXT_PRIVATE_UPLOAD_REGION` | `ca-central-1` | SDK default is `us-east-1` — we pin it |
| `NEXT_PRIVATE_UPLOAD_BUCKET` | `northsign-documents` | |
| `NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID` | `northsign-app` key id | |
| `NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY` | `northsign-app` secret | |
| `NEXT_PRIVATE_UPLOAD_ENDPOINT` | *(empty)* | empty = real AWS S3 |
| `NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE` | `false` | virtual-hosted style |

**Pre-flight test from the VM** (after creating the user, before first deploy):

```bash
export AWS_PROFILE=northsign-app
aws s3 cp /tmp/smoke.pdf s3://northsign-documents/smoke-test/smoke.pdf --region ca-central-1
aws s3 presign s3://northsign-documents/smoke-test/smoke.pdf --expires-in 300 --region ca-central-1
# curl the returned URL → expect your PDF bytes
aws s3 rm s3://northsign-documents/smoke-test/smoke.pdf --region ca-central-1
```

**Post-deploy verification** (part of the DEPLOY.md smoke test): upload a
document in the app, then confirm the object exists:

```bash
aws s3 ls s3://northsign-documents/ --recursive --region ca-central-1 \
  --profile northsign-app | tail -5
```

And confirm **delete is recoverable** (versioning working): delete a test
document in the app, then

```bash
aws s3api list-object-versions --bucket northsign-documents \
  --prefix <deleted-object-key> --region ca-central-1 \
  --profile northsign-app
```

---

**Residency check:** both buckets, all object data, and all version history
are physically in ca-central-1 (Montreal). If a bucket is ever recreated in
another region, that is a residency-claim breach — D-017.
