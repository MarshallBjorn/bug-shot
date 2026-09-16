#!/bin/bash
# PID 1 kontenera backupu. Waliduje wymagane env, generuje crontab i odpala supercronic.
# set -e: przerwij na pierwszym niezerowym exit
# set -u: przerwij na uzyciu nieustawionej zmiennej
# set -o pipefail: exit code pipe = pierwszy padajacy element
set -euo pipefail

# Wymagane env — bez nich backup nie ma sensu. Padamy od razu, nie na 03:00 UTC.
required=(
    BACKUP_AGE_PUBLIC_KEY
    S3_BUCKET
    S3_ENDPOINT_URL
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    DISCORD_WEBHOOK_URL
    POSTGRES_HOST
    POSTGRES_DB
    POSTGRES_USER
    POSTGRES_PASSWORD
)

missing=()
for var in "${required[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        missing+=("$var")
    fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
    echo "FATAL: brak wymaganych zmiennych srodowiskowych: ${missing[*]}" >&2
    exit 1
fi

# Harmonogram z env (UTC — patrz Dockerfile: TZ=UTC). Domyslne = prod.
# Do testu ustaw np. CRON_PG="* * * * *" w compose/.env i zrob `up -d backup` — bez rebuildu.
CRON_PG="${CRON_PG:-0 3 * * *}"
CRON_MEDIA="${CRON_MEDIA:-0 4 * * 0}"
CRON_CLEANUP="${CRON_CLEANUP:-0 5 * * *}"

# rootfs jest read_only → crontab generujemy do /tmp (tmpfs, zapisywalne).
# supercronic -passthrough-logs zbiera stdout/stderr jobow do docker logs.
readonly CRONTAB=/tmp/crontab
{
    echo "${CRON_PG}       /scripts/backup-pg.sh"
    echo "${CRON_MEDIA}    /scripts/backup-media.sh"
    echo "${CRON_CLEANUP}  /scripts/cleanup.sh"
    echo ""
} > "${CRONTAB}"

echo "[$(date -u +%FT%TZ)] backup container up, cron schedule:" >&2
cat "${CRONTAB}" >&2

exec supercronic -passthrough-logs "${CRONTAB}"
