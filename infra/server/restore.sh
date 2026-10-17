#!/usr/bin/env bash
# Restore (or just verify) a backup made by backup.sh.
#
#   restore.sh <backup.dump.age> <age-identity-file>               verify only: restore into a scratch database, print
#                                                                   table counts, drop the scratch database. Changes nothing live.
#   restore.sh <backup.dump.age> <age-identity-file> --into-live   ALSO replace the live database (asks you to type YES;
#                                                                   stops the backend first, starts it again afterwards).
#
# The private key file (age-keygen output) lives on your laptop/password manager, never on the server. Copy it over
# only for the duration of a restore, then delete it:   shred -u key.txt
#
# After restoring, the app only works if DATA_ENCRYPTION_KEYS in .env.production holds the key the data was written with.
set -euo pipefail
umask 077

BACKUP="${1:-}"; KEYFILE="${2:-}"; MODE="${3:-}"
APP_DIR="${APP_DIR:-/opt/peterhouse}"
PGUSER_="${POSTGRES_USER:-peterhouse}"
PGDB="${POSTGRES_DB:-peterhouse}"
SCRATCH="restore_verify_$(date +%s)"
die() { echo "ERROR: $*" >&2; exit 1; }
[[ -f "$BACKUP" && -f "$KEYFILE" ]] || die "usage: $0 <backup.dump.age> <age-identity-file> [--into-live]"
[[ -z "$MODE" || "$MODE" == "--into-live" ]] || die "unknown option $MODE"
command -v age >/dev/null || die "age is not installed"

dc() { (cd "$APP_DIR" && docker compose -f docker-compose.prod.yml --env-file .env.production "$@"); }
if [[ -n "${DB_CONTAINER:-}" ]]; then
  CID="$DB_CONTAINER"
else
  CID="$(dc ps -q db)"; [[ -n "$CID" ]] || die "the db container is not running"
fi
psql_() { docker exec -i "$CID" psql -U "$PGUSER_" -v ON_ERROR_STOP=1 -qAt "$@"; }

SUM="$BACKUP.sha256"
if [[ -f "$SUM" ]]; then (cd "$(dirname "$BACKUP")" && sha256sum -c "$(basename "$SUM")") || die "checksum mismatch: the backup file is damaged"; fi

echo "== 1. Decrypting and restoring into scratch database $SCRATCH"
trap 'docker exec "$CID" dropdb -U "$PGUSER_" --if-exists "$SCRATCH" >/dev/null 2>&1 || true' EXIT
docker exec "$CID" createdb -U "$PGUSER_" "$SCRATCH"
age -d -i "$KEYFILE" "$BACKUP" | docker exec -i "$CID" pg_restore -U "$PGUSER_" -d "$SCRATCH" --no-owner --exit-on-error

echo "== 2. Verifying"
psql_ -d "$SCRATCH" -c "SELECT 1 FROM schema_migrations LIMIT 1" | grep -q 1 || die "no schema_migrations rows: this does not look like a Peterhouse backup"
echo "Rows per table in the backup (live database in brackets, if it exists):"
TABLES="$(psql_ -d "$SCRATCH" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")"
for t in $TABLES; do
  b="$(psql_ -d "$SCRATCH" -c "SELECT count(*) FROM \"$t\"")"
  l="$(psql_ -d "$PGDB" -c "SELECT count(*) FROM \"$t\"" 2>/dev/null || echo "-")"
  printf '  %-20s %8s   [live %s]\n' "$t" "$b" "$l"
done
U="$(psql_ -d "$SCRATCH" -c "SELECT count(*) FROM users")"
[[ "$U" -ge 1 ]] || die "the backup has no users"
echo "Latest migration: $(psql_ -d "$SCRATCH" -c "SELECT max(version) FROM schema_migrations")"
echo "Verification OK. (The rows are encrypted; they are only readable by an app that has the original DATA_ENCRYPTION_KEYS.)"

[[ "$MODE" == "--into-live" ]] || { echo "Verify-only run: live database untouched."; exit 0; }

echo
read -r -p "Type YES to REPLACE the live database '$PGDB' with this backup: " ans
[[ "$ans" == "YES" ]] || die "cancelled"
echo "== 3. Replacing the live database"
[[ -n "${DB_CONTAINER:-}" ]] || dc stop backend
# Take a safety copy of what is there now, in case this was a mistake.
SAFETY="/var/backups/peterhouse/pre-restore-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "$(dirname "$SAFETY")"
docker exec "$CID" pg_dump -U "$PGUSER_" -d "$PGDB" -Fc > "$SAFETY" && echo "Safety copy of the current data (UNENCRYPTED dump of already-encrypted columns): $SAFETY"
docker exec "$CID" psql -U "$PGUSER_" -d postgres -qAt -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$PGDB' AND pid <> pg_backend_pid()" >/dev/null
docker exec "$CID" dropdb -U "$PGUSER_" "$PGDB"
docker exec "$CID" createdb -U "$PGUSER_" "$PGDB"
age -d -i "$KEYFILE" "$BACKUP" | docker exec -i "$CID" pg_restore -U "$PGUSER_" -d "$PGDB" --no-owner --exit-on-error
[[ -n "${DB_CONTAINER:-}" ]] || dc start backend
echo "Restored. Sign in and check a child's record opens (it proves the encryption key matches)."
