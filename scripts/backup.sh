#!/usr/bin/env bash
#
# NorthSign nightly PostgreSQL backup → S3 (ca-central-1)
#
# - pg_dump in custom format, piped out of the database container (Postgres
#   is never exposed on the VM host).
# - Uploaded to s3://northsign-backups/northsign-postgres/YYYY-MM-DD.dump
# - On Mondays also kept as .../weekly/YYYY-MM-DD.dump
# - Retention: newest 14 daily dumps + newest 4 weekly dumps (everything
#   older is pruned). Documents themselves are covered by S3 versioning on
#   the documents bucket (see RESTORE.md).
#
# Run from cron on the VM as the deploy user (in the docker group):
#
#   crontab -e
#   0 2 * * * /home/northsign/northsign/scripts/backup.sh >> /var/log/northsign-backup.log 2>&1
#
# (02:00 local — the VM timezone is America/Toronto, runbook 04. Alternative:
#  a systemd timer with OnCalendar=*-*-* 02:00:00 America/Toronto.)
#
# Requires: docker compose plugin, aws CLI v2, and the BackupUser AWS
# profile configured in ~/.aws/credentials (see docs/runbooks/01-storage-s3.md).

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Load the VM configuration (real secrets live in .env on the VM only —
# never committed). Values are KEY="value" lines; `set -a` exports them.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# --- Configuration (overridable via the environment) ---
BACKUP_BUCKET="${BACKUP_BUCKET:-northsign-backups}"
AWS_PROFILE="${AWS_PROFILE:-northsign-backup}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ca-central-1}"
export AWS_PROFILE
export AWS_PAGER=""

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
POSTGRES_USER="${POSTGRES_USER:?POSTGRES_USER is required (set it in .env)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required (set it in .env)}"
POSTGRES_DB="${POSTGRES_DB:?POSTGRES_DB is required (set it in .env)}"

command -v aws >/dev/null 2>&1 || { echo "FATAL: aws CLI v2 not found on PATH" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "FATAL: docker not found on PATH" >&2; exit 1; }

STAMP="$(date +%F)"
WEEKDAY="$(date +%u)" # 1 = Monday
TMP_DUMP="/tmp/northsign-${STAMP}.dump"
DAILY_PREFIX="northsign-postgres"
WEEKLY_PREFIX="northsign-postgres/weekly"

echo "[$(date -Is)] NorthSign backup starting (${STAMP})"

# --- 1. Dump (custom format) via the database container ---
echo "[$(date -Is)] pg_dump → ${TMP_DUMP}"
PGPASSWORD="$POSTGRES_PASSWORD" docker compose -f "$COMPOSE_FILE" exec -T database \
  pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom \
  > "$TMP_DUMP"

[ -s "$TMP_DUMP" ] || { echo "FATAL: pg_dump produced an empty file" >&2; exit 1; }

# --- 2. Upload daily ---
echo "[$(date -Is)] uploading s3://${BACKUP_BUCKET}/${DAILY_PREFIX}/${STAMP}.dump"
aws s3 cp "$TMP_DUMP" "s3://${BACKUP_BUCKET}/${DAILY_PREFIX}/${STAMP}.dump" --only-show-errors

# --- 3. Keep a weekly copy (Mondays) ---
if [ "$WEEKDAY" = "1" ]; then
  echo "[$(date -Is)] uploading weekly copy"
  aws s3 cp "$TMP_DUMP" "s3://${BACKUP_BUCKET}/${WEEKLY_PREFIX}/${STAMP}.dump" --only-show-errors
fi

# --- 4. Retention: newest 14 daily dumps ---
echo "[$(date -Is)] pruning daily dumps (keeping newest 14)"
aws s3 ls "s3://${BACKUP_BUCKET}/${DAILY_PREFIX}/" 2>/dev/null \
  | awk '{print $4}' \
  | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.dump$' \
  | sort -r \
  | tail -n +15 \
  | while IFS= read -r key; do
      echo "  pruning daily ${key}"
      aws s3 rm "s3://${BACKUP_BUCKET}/${DAILY_PREFIX}/${key}" --only-show-errors
    done

# --- 5. Retention: newest 4 weekly dumps ---
echo "[$(date -Is)] pruning weekly dumps (keeping newest 4)"
aws s3 ls "s3://${BACKUP_BUCKET}/${WEEKLY_PREFIX}/" 2>/dev/null \
  | awk '{print $4}' \
  | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.dump$' \
  | sort -r \
  | tail -n +5 \
  | while IFS= read -r key; do
      echo "  pruning weekly ${key}"
      aws s3 rm "s3://${BACKUP_BUCKET}/${WEEKLY_PREFIX}/${key}" --only-show-errors
    done

# --- 6. Clean up local temp ---
rm -f "$TMP_DUMP"

echo "[$(date -Is)] NorthSign backup complete"
