#!/bin/bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly PG_RETENTION_DAYS=14
readonly MEDIA_RETENTION_DAYS=56
readonly UPLOADING_RETENTION_DAYS=1

readonly CUTOFF_PG=$(date -u -d "${PG_RETENTION_DAYS} days ago" +%Y-%m-%d)
readonly CUTOFF_MEDIA=$(date -u -d "${MEDIA_RETENTION_DAYS} days ago" +%Y-%m-%d)
readonly CUTOFF_UPLOADING=$(date -u -d "${UPLOADING_RETENTION_DAYS} days ago" +%Y-%m-%d)

log() { echo "[$(date -u +%FT%TZ)] ${SCRIPT_NAME}: $*"; }

on_error() {
    local exit_code=$?
    local line=$1
    log "FAILED at line ${line} (exit ${exit_code})"
    /scripts/notify.sh failure "${SCRIPT_NAME}" "line ${line}, exit ${exit_code}" || true
    exit "${exit_code}"
}
trap 'on_error $LINENO' ERR

# Usuwa obiekty ze zbioru $prefix ktore matchuja $pattern i sa starsze niz $cutoff.
# $pattern to regex bash matchujacy nazwy plikow (nie caly URI).
# Bezpiecznie ignoruje pliki nie pasujace do wzorca.
cleanup_prefix() {
    local prefix=$1
    local pattern=$2
    local cutoff=$3

    log "cleaning ${prefix} — kasujemy < ${cutoff}, wzorzec: ${pattern}"

    local deleted=0
    local kept=0
    local skipped=0

    # aws s3 ls format: <date> <time> <size> <key>
    # Podscieżkowy prefix (--recursive nie potrzebny, katalog plaski).
    while read -r date_col time_col size_col key; do
        # Puste linie / naglowki
        [[ -z "${key:-}" ]] && continue

        # Sprawdz czy key matchuje nasz format
        if [[ ! "${key}" =~ ${pattern} ]]; then
            log "  skip (nie nasz format): ${key}"
            skipped=$((skipped + 1))
            continue
        fi

        # Wyciagnij date z nazwy (zawsze YYYY-MM-DD na poczatku).
        local file_date="${key:0:10}"

        # Porownanie stringow lexicograficznie == porownanie dat (dziala dla YYYY-MM-DD).
        if [[ "${file_date}" < "${cutoff}" ]]; then
            log "  DEL: ${prefix}${key} (${file_date} < ${cutoff})"
            aws s3 rm "s3://${S3_BUCKET}/${prefix}${key}" \
                --endpoint-url "${S3_ENDPOINT_URL}" >/dev/null
            deleted=$((deleted + 1))
        else
            kept=$((kept + 1))
        fi
    done < <(aws s3 ls "s3://${S3_BUCKET}/${prefix}" \
        --endpoint-url "${S3_ENDPOINT_URL}")

    log "${prefix}: deleted=${deleted} kept=${kept} skipped=${skipped}"
}

log "start"

# pg/YYYY-MM-DD.sql.gz.age → 14 dni
cleanup_prefix "pg/" '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.sql\.gz\.age$' "${CUTOFF_PG}"

# media/YYYY-MM-DD.tar.gz.age → 56 dni
cleanup_prefix "media/" '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.age$' "${CUTOFF_MEDIA}"

# Osierocone *.uploading (crash w polowie) → 1 dzien
cleanup_prefix "pg/"    '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.sql\.gz\.age\.uploading$' "${CUTOFF_UPLOADING}"
cleanup_prefix "media/" '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.tar\.gz\.age\.uploading$' "${CUTOFF_UPLOADING}"

log "done"
