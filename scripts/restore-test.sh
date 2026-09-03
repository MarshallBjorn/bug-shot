#!/bin/bash
set -euo pipefail

# --- Config ---
readonly BUCKET="bugshot-backups"
readonly RESTORE_DB="bugshot_restore_test"
readonly RESTORE_CONTAINER="bugshot-postgres-restore"
readonly RESTORE_PORT="${RESTORE_PORT:-5434}"
readonly AGE_KEY="test-keys/backup-dev.age-key"
readonly NETWORK="bugshot_internal"
readonly TMP_DIR=".restore-tmp"

# Demo project ID z api.md — jesli tego rekordu nie ma, migracje nie zaszly
# albo backup jest z pustej bazy.
readonly DEMO_PROJECT_ID="11111111-1111-1111-1111-111111111111"

log() { echo "[restore-test] $*"; }
fail() { echo "[restore-test] FAIL: $*" >&2; exit 1; }

# --- Cleanup na kazde wyjscie ---
cleanup() {
    log "cleanup..."
    docker rm -f "${RESTORE_CONTAINER}" >/dev/null 2>&1 || true
    rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# --- 1. Sanity checks ---
if [[ ! -f .env ]]; then
    fail ".env nie istnieje w root projektu"
fi
if [[ ! -f "${AGE_KEY}" ]]; then
    fail "${AGE_KEY} nie istnieje (potrzebny do deszyfracji)"
fi

# Load .env
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${MINIO_ROOT_USER:?not set in .env}"
: "${MINIO_ROOT_PASSWORD:?not set in .env}"
: "${POSTGRES_USER:=bugshot}"
: "${POSTGRES_PASSWORD:=change-me-dev-only}"

# --- 2. Znajdz najnowszy pg backup ---
log "szukam najnowszego pg backupu w s3://${BUCKET}/pg/..."
LATEST=$(docker run --rm --network "${NETWORK}" --entrypoint sh minio/mc:latest -c "
    mc alias set local http://minio:9000 '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}' >/dev/null
    mc ls local/${BUCKET}/pg/ 2>/dev/null
" | grep -E '\.sql\.gz\.age$' | awk '{print $NF}' | sort | tail -1)

if [[ -z "${LATEST}" ]]; then
    fail "brak backupow w s3://${BUCKET}/pg/. Odpal najpierw: docker compose exec backup /scripts/backup-pg.sh"
fi
log "uzyje: ${LATEST}"

# --- 3. Pobierz zaszyfrowany backup ---
mkdir -p "${TMP_DIR}"
log "pobieram..."
docker run --rm --network "${NETWORK}" \
    -v "$(pwd)/${TMP_DIR}:/out" \
    --entrypoint sh minio/mc:latest -c "
    mc alias set local http://minio:9000 '${MINIO_ROOT_USER}' '${MINIO_ROOT_PASSWORD}' >/dev/null
    mc cp local/${BUCKET}/pg/${LATEST} /out/
" >/dev/null

# --- 4. Deszyfracja + gunzip ---
log "deszyfruje age + gunzip..."
docker run --rm -i \
    -v "$(pwd)/${AGE_KEY}:/keys/backup-dev.age-key:ro" \
    alpine:3.20 sh -c '
        apk add -q age
        age -d -i /keys/backup-dev.age-key
    ' < "${TMP_DIR}/${LATEST}" | gunzip > "${TMP_DIR}/restore.sql"

sql_lines=$(wc -l < "${TMP_DIR}/restore.sql")
log "SQL rozpakowany: ${sql_lines} linii"

if [[ "${sql_lines}" -lt 10 ]]; then
    fail "SQL wyglada podejrzanie krotko (${sql_lines} linii). Baza byla pusta w chwili backupu?"
fi

# --- 5. Ephemeral Postgres ---
log "startuje efemeryczny postgres na porcie ${RESTORE_PORT}..."
docker rm -f "${RESTORE_CONTAINER}" >/dev/null 2>&1 || true
docker run -d --name "${RESTORE_CONTAINER}" \
    -e POSTGRES_DB="${RESTORE_DB}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -p "127.0.0.1:${RESTORE_PORT}:5432" \
    postgres:16-alpine >/dev/null

# Czekaj az postgres jest ready (max 30s)
log "czekam az postgres ready (bootstrap + real start)..."
for i in $(seq 1 60); do
    # pg_isready + prawdziwe SELECT — pg_isready mowi TAK juz w fazie initdb,
    # ale wtedy postgres zaraz sie restartuje. Realne SELECT laczy sie tylko
    # gdy jest juz w koncowej fazie serwowania.
    if docker exec "${RESTORE_CONTAINER}" \
            pg_isready -U "${POSTGRES_USER}" -d "${RESTORE_DB}" >/dev/null 2>&1 \
        && docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${RESTORE_CONTAINER}" \
            psql -U "${POSTGRES_USER}" -d "${RESTORE_DB}" -tAc "SELECT 1" >/dev/null 2>&1; then
        break
    fi
    if [[ ${i} -eq 60 ]]; then
        fail "postgres nie wystartowal w 60s"
    fi
    sleep 1
done

# --- 6. Restore ---
# --clean --if-exists w pg_dump juz zawiera DROP-y, wiec psql wykona je na
# swiezej bazie (no-op na DROP-ach ktore nic nie znajduja) + CREATE nowej struktury.
log "aplikuje SQL..."
docker exec -i \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "${RESTORE_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d "${RESTORE_DB}" \
    --set ON_ERROR_STOP=on \
    --quiet \
    < "${TMP_DIR}/restore.sql" 2>&1 | grep -v -E '^(NOTICE|SET|--)' || true

# --- 7. Weryfikacja demo projektu ---
log "sprawdzam czy demo project istnieje..."
if ! result=$(docker exec \
        -e PGPASSWORD="${POSTGRES_PASSWORD}" \
        "${RESTORE_CONTAINER}" \
        psql -U "${POSTGRES_USER}" -d "${RESTORE_DB}" -tAc \
        "SELECT count(*) FROM projects WHERE id = '${DEMO_PROJECT_ID}'" 2>&1); then
    fail "query padl: ${result}. Prawdopodobnie tabela 'projects' nie istnieje w odtworzonej bazie — migracje nie zaszly przed backupem. Wykonaj 'dotnet ef database update' w folderze backend, potem 'make backup-pg', potem 'make restore-test' ponownie."
fi

if [[ "${result}" != "1" ]]; then
    fail "demo project '${DEMO_PROJECT_ID}' NIE znaleziony (count=${result})."
fi
# --- 8. Bonus: policz ile tabel jest w schemacie ---
tables=$(docker exec \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "${RESTORE_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d "${RESTORE_DB}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null)

log "PASS: demo project znaleziony, ${tables} tabel w public schema"
log "restore-test: OK"
