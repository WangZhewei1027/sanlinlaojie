#!/usr/bin/env bash
# Nightly database backup, installed on the server by scripts/deploy.sh as
# /opt/sanlin/backup.sh and run from /etc/cron.d/sanlin-backup.
#
# pg_dump (custom format, inside the db container) → gzip → private OSS bucket
# sanlinlaojie-backups/db/<timestamp>.dump, which expires objects after 30 days
# (bucket lifecycle rule). Local copies are kept for 3 days in /opt/sanlin/backups.
#
# Restore: ossutil cp oss://sanlinlaojie-backups/db/<file> . &&
#   docker compose exec -T db pg_restore -U sanlin -d sanlin --clean --if-exists < <file>
set -euo pipefail
DIR=/opt/sanlin
cd "$DIR"
set -a; . ./.env; set +a

BACKUP_BUCKET=${BACKUP_BUCKET:-sanlinlaojie-backups}
ENDPOINT=${OSS_BACKUP_ENDPOINT:-oss-cn-shanghai-internal.aliyuncs.com}
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="backups/sanlin-$STAMP.dump"

docker compose exec -T db pg_dump -U sanlin -d sanlin --format=custom --compress=6 > "$FILE"
SIZE=$(stat -c %s "$FILE")
[ "$SIZE" -gt 1024 ] || { echo "backup too small ($SIZE bytes)"; exit 1; }

ossutil cp -f "$FILE" "oss://$BACKUP_BUCKET/db/sanlin-$STAMP.dump" \
  -e "$ENDPOINT" -i "$ALIBABA_CLOUD_ACCESS_KEY_ID" -k "$ALIBABA_CLOUD_ACCESS_KEY_SECRET" >/dev/null

find backups -name 'sanlin-*.dump' -mtime +3 -delete
echo "backup ok: $FILE ($SIZE bytes) → oss://$BACKUP_BUCKET/db/"
