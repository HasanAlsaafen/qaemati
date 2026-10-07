#!/usr/bin/env bash
# Backs up the database and the uploaded photos into ./backups.
#
#   scripts/backup.sh                 uses DATABASE_URL (a postgres client is needed)
#   COMPOSE=1 scripts/backup.sh       reads the production compose stack instead
#
# Keeps the newest KEEP backups (default 14). Run it daily from cron, and copy
# the backups folder off the server: a backup on the same disk is not a backup.
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP="${KEEP:-14}"
DEST="${BACKUP_DIR:-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

if [ "${COMPOSE:-0}" = "1" ]; then
  set -a; . ./.env.production; set +a
  DC="docker compose -f docker-compose.prod.yml --env-file .env.production"
  $DC exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$DEST/db-$STAMP.dump"
  $DC exec -T app tar -C /app/public -czf - uploads > "$DEST/uploads-$STAMP.tar.gz"
else
  : "${DATABASE_URL:?DATABASE_URL is not set}"
  pg_dump -Fc "${DATABASE_URL%%\?*}" > "$DEST/db-$STAMP.dump"
  if [ -d public/uploads ]; then
    tar -C public -czf "$DEST/uploads-$STAMP.tar.gz" uploads
  else
    tar -czf "$DEST/uploads-$STAMP.tar.gz" --files-from /dev/null
  fi
fi

# A dump that is empty or cannot be listed would only be noticed on the worst day.
pg_restore --list "$DEST/db-$STAMP.dump" > /dev/null
tar -tzf "$DEST/uploads-$STAMP.tar.gz" > /dev/null

for kind in db uploads; do
  ls -1t "$DEST"/$kind-* 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm --
done
echo "Backup written: $DEST/db-$STAMP.dump and $DEST/uploads-$STAMP.tar.gz"
