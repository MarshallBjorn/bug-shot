#!/bin/bash
# PID 1 kontenera backupu. Waliduje wymagane env i odpala crond w foreground.
# set -e: przerwij na pierwszym niezerowym exit
# set -u: przerwij na uzyciu nieustawionej zmiennej (chroni przed literowkami)
# set -o pipefail: exit code pipe = exit code pierwszego padajacego elementu
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

echo "[$(date -u +%FT%TZ)] backup container up, cron schedule:" >&2
cat /crontab >&2

# -f: foreground (nie forkuj, PID 1 zostaje przy nas)
# -d 8: log level 8 (max verbose, wszystko na stderr — laczy sie z docker logs)
exec supercronic -passthrough-logs /crontab
