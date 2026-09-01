#!/bin/bash
# Backup katalogu attachments → tar.gz → age → S3 (streaming).
#
# Zakladany mount w compose: ./bug-shot-attachments:/attachments:ro
# Jesli mount nie istnieje albo katalog pusty — tar zrobi pusty archiwum
# i to pojedzie na S3. Kontrola tego jest w warningu ponizej po uploadzie.
#
# Naming i atomowosc — analogicznie do backup-pg.sh.

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly DATE_UTC="$(date -u +%Y-%m-%d)"
readonly KEY="media/${DATE_UTC}.tar.gz.age"
readonly TMP_KEY="${KEY}.uploading"
readonly SOURCE_DIR="/attachments"

log() { echo "[$(date -u +%FT%TZ)] ${SCRIPT_NAME}: $*"; }

on_error() {
    local exit_code=$?
    local line=$1
    log "FAILED at line ${line} (exit ${exit_code})"
    /scripts/notify-failure.sh "${SCRIPT_NAME}" "${line}" "${exit_code}" || true
    aws s3 rm "s3://${S3_BUCKET}/${TMP_KEY}" \
        --endpoint-url "${S3_ENDPOINT_URL}" 2>/dev/null || true
    exit "${exit_code}"
}
trap 'on_error $LINENO' ERR

if [[ ! -d "${SOURCE_DIR}" ]]; then
    log "FAILED: ${SOURCE_DIR} nie istnieje (sprawdz mount w compose)"
    exit 1
fi

log "start → s3://${S3_BUCKET}/${KEY}"

# tar -C / attachments → archiwum ma sciezki wzgledne "attachments/..."
# zamiast absolutnych "/attachments/..." — porzadniej przy restore.
# -z: gzip in-place (nie potrzebujemy osobnego pipe do gzip).
# --warning=no-file-changed: pliki dodane przez API w trakcie tar nie sa
# bledem, tylko ostrzezeniem. Bez tego tar konczy z exit 1 i pipefail nas
# wywala mimo ze backup jest dobry (bez tego jednego pliku ktory sie
# dopiero pojawil — wezmiemy go jutro).
tar --create --gzip --file=- \
        --directory=/ \
        --warning=no-file-changed \
        attachments \
    | age -r "${BACKUP_AGE_PUBLIC_KEY}" \
    | aws s3 cp - "s3://${S3_BUCKET}/${TMP_KEY}" \
        --endpoint-url "${S3_ENDPOINT_URL}"

aws s3 mv "s3://${S3_BUCKET}/${TMP_KEY}" "s3://${S3_BUCKET}/${KEY}" \
    --endpoint-url "${S3_ENDPOINT_URL}"

size=$(aws s3api head-object \
    --bucket "${S3_BUCKET}" \
    --key "${KEY}" \
    --endpoint-url "${S3_ENDPOINT_URL}" \
    --query 'ContentLength' \
    --output text)

log "done: uploaded ${size} bytes"

# Pusty tar.gz ma ok. 45 bajtow (gzip header + empty), sprawdzamy < 200
# zeby zlapac przypadek "katalog istnieje ale jest pusty" — w tickecie
# tego nie chcemy przemilczec.
if [[ "${size}" -lt 200 ]]; then
    log "WARNING: backup < 200B, ${SOURCE_DIR} prawdopodobnie pusty"
fi
