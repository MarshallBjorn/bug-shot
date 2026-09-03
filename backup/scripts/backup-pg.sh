#!/bin/bash
# Backup Postgres → gzip → age → S3 (streaming, bez temp file na dysku).
#
# Zaszyfrowany asymetrycznie: kontener zna wylacznie public key, private key
# trzymany offline. Nawet pelen dostep do bucketu + kontenera nie wystarczy
# zeby odczytac backup (threat model: "obcy S3 provider").
#
# Nazwa docelowa: pg/YYYY-MM-DD.sql.gz.age (data UTC).
# Podczas uploadu: pg/YYYY-MM-DD.sql.gz.age.uploading — dopiero po sukcesie
# calego pipe'a robimy rename. Cel: cleanup nie odrozni niedokonczonego
# streamu od dobrego backupu jesli tego nie zrobimy.

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly DATE_UTC="$(date -u +%Y-%m-%d)"
readonly KEY="pg/${DATE_UTC}.sql.gz.age"
readonly TMP_KEY="${KEY}.uploading"

log() { echo "[$(date -u +%FT%TZ)] ${SCRIPT_NAME}: $*"; }

on_error() {
    local exit_code=$?
    local line=$1
    log "FAILED at line ${line} (exit ${exit_code})"
    # Discord alert — na razie placeholder, wypelnimy w nastepnym kroku.
    /scripts/notify-failure.sh "${SCRIPT_NAME}" "${line}" "${exit_code}" || true
    # Sprobuj sprzatnac niedokonczony upload — best effort, nie failujemy jesli sie nie uda.
    aws s3 rm "s3://${S3_BUCKET}/${TMP_KEY}" \
        --endpoint-url "${S3_ENDPOINT_URL}" 2>/dev/null || true
    exit "${exit_code}"
}
trap 'on_error $LINENO' ERR

log "start → s3://${S3_BUCKET}/${KEY}"

# pg_dump w formacie plain (uniwersalny, dziala z psql) + gzip -9 + age + s3 cp.
# --no-owner / --no-privileges: dump portowalny miedzy environmentami, bez
# przywiazania do konkretnego usera bazy przy restore.
# --clean --if-exists: restore-owy plik zaczyna od DROP-ow, wiec restore
# nadpisuje istniejaca baze zamiast dokladac.
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        --host="${POSTGRES_HOST}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="${POSTGRES_DB}" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
    | gzip -9 \
    | age -r "${BACKUP_AGE_PUBLIC_KEY}" \
    | aws s3 cp - "s3://${S3_BUCKET}/${TMP_KEY}" \
        --endpoint-url "${S3_ENDPOINT_URL}"

# Atomowy finish: dopiero teraz mamy pewnosc ze pg_dump/gzip/age/aws przeszly.
# aws s3 mv na tym samym buckecie = server-side copy + delete (nie sciaga na kontener).
aws s3 mv "s3://${S3_BUCKET}/${TMP_KEY}" "s3://${S3_BUCKET}/${KEY}" \
    --endpoint-url "${S3_ENDPOINT_URL}"

# Zaloguj rozmiar — zerowy plik to znak ze cos poszlo nie tak nawet jesli exit 0.
size=$(aws s3api head-object \
    --bucket "${S3_BUCKET}" \
    --key "${KEY}" \
    --endpoint-url "${S3_ENDPOINT_URL}" \
    --query 'ContentLength' \
    --output text)

log "done: uploaded ${size} bytes"

if [[ "${size}" -lt 1024 ]]; then
    log "WARNING: backup < 1KB, mozliwe ze pusta baza lub cos nie tak"
fi
