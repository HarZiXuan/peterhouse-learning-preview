#!/usr/bin/env bash
# Daily backup: one pg_dump (everything lives in Postgres, photos included), encrypted with `age` to a PUBLIC key,
# so the server can write backups but can never read them. Optionally copied off-site with rclone.
#
# Config (from the environment, normally /etc/peterhouse/backup.env via the systemd unit):
#   AGE_RECIPIENT   required  age public key (age1…) — the matching private key is NOT on this server
#   BACKUP_DIR      default /var/backups/peterhouse
#   KEEP_DAYS       default 14
#   RCLONE_REMOTE   optional  e.g. offsite:my-bucket/peterhouse  (unset → off-site copy skipped with a warning)
#   APP_DIR         default /opt/peterhouse          DB_CONTAINER  optional override (default: the compose "db" service)
#   POSTGRES_USER / POSTGRES_DB   default peterhouse
#
# IMPORTANT: the dump holds ENCRYPTED columns. It cannot be read without DATA_ENCRYPTION_KEYS (kept separately).
set -euo pipefail
umask 077

APP_DIR="${APP_DIR:-/opt/peterhouse}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/peterhouse}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PGUSER_="${POSTGRES_USER:-peterhouse}"
PGDB="${POSTGRES_DB:-peterhouse}"
log()  { echo "$(date -Is) backup: $*"; }
fail() { echo "$(date -Is) backup: FAILED: $*" >&2; exit 1; }

[[ -n "${AGE_RECIPIENT:-}" ]] || fail "AGE_RECIPIENT is not set"
[[ "$AGE_RECIPIENT" == age1* ]] || fail "AGE_RECIPIENT must be an age PUBLIC key (starts with age1)"
command -v age >/dev/null || fail "age is not installed"

db_container() {
  if [[ -n "${DB_CONTAINER:-}" ]]; then echo "$DB_CONTAINER"; return; fi
  local id; id="$(cd "$APP_DIR" && docker compose -f docker-compose.prod.yml --env-file .env.production ps -q db)"
  [[ -n "$id" ]] || fail "the db container is not running"
  echo "$id"
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/peterhouse-$STAMP.dump.age"
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

CID="$(db_container)"
log "dumping $PGDB from container ${CID:0:12}"
# -Fc: compressed custom format (restorable table by table). Written to a .partial file and renamed only on success.
docker exec "$CID" pg_dump -U "$PGUSER_" -d "$PGDB" -Fc --no-owner | age -r "$AGE_RECIPIENT" -o "$TMP"
[[ -s "$TMP" ]] || fail "backup file is empty"
chmod 600 "$TMP"
mv "$TMP" "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
log "wrote $OUT ($(du -h "$OUT" | cut -f1))"

log "removing local backups older than $KEEP_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -name 'peterhouse-*.dump.age*' -mtime +"$KEEP_DAYS" -print -delete

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  command -v rclone >/dev/null || fail "rclone is not installed"
  log "copying to $RCLONE_REMOTE"
  rclone copy "$OUT" "$RCLONE_REMOTE" --immutable --retries 3 || fail "off-site copy failed"
  rclone copy "$OUT.sha256" "$RCLONE_REMOTE" --immutable --retries 3 || fail "off-site checksum copy failed"
  # Off-site retention is the bucket's lifecycle rule (see docs/DEPLOY.md); rclone only ever adds files, never deletes.
  log "off-site copy done"
else
  echo "$(date -Is) backup: WARNING: RCLONE_REMOTE is not set, so this backup exists ONLY on this server. A lost VPS means lost backups." >&2
fi
log "OK"
