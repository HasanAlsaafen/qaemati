#!/usr/bin/env bash
# Restores a database dump and, optionally, the uploads archive.
#
#   scripts/restore.sh backups/db-20261007-020000.dump [backups/uploads-20261007-020000.tar.gz]
#   COMPOSE=1 scripts/restore.sh ...      restores into the production compose stack
#
# THIS REPLACES THE CURRENT DATA. It asks you to type the word restore first.
# Try it on a copy before the day you need it: TARGET_URL points it at another database.
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP="${1:?Usage: scripts/restore.sh <db dump> [uploads archive]}"
UPLOADS="${2:-}"
[ -f "$DUMP" ] || { echo "No such file: $DUMP" >&2; exit 1; }

if [ "${CONFIRM:-}" != "restore" ]; then
  read -r -p "This replaces the current data with $DUMP. Type 'restore' to continue: " answer
  [ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }
fi

if [ "${COMPOSE:-0}" = "1" ]; then
  set -a; . ./.env.production; set +a
  DC="docker compose -f docker-compose.prod.yml --env-file .env.production"
  $DC stop app
  $DC exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner < "$DUMP"
  [ -z "$UPLOADS" ] || $DC run --rm --no-deps -T app tar -C /app/public -xzf - < "$UPLOADS"
  $DC start app
else
  TARGET="${TARGET_URL:-${DATABASE_URL:?DATABASE_URL or TARGET_URL is not set}}"
  pg_restore -d "${TARGET%%\?*}" --clean --if-exists --no-owner "$DUMP"
  [ -z "$UPLOADS" ] || { mkdir -p public; tar -C public -xzf "$UPLOADS"; }
fi
echo "Restored from $DUMP"
