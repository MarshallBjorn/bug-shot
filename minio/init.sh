#!/bin/sh
set -eu

log() { echo "[minio-init] $*" >&2; }

: "${MINIO_ROOT_USER:?}"
: "${MINIO_ROOT_PASSWORD:?}"
: "${BACKUP_ACCESS_KEY_ID:?}"
: "${BACKUP_SECRET_ACCESS_KEY:?}"

# --- 1. Czekaj az minio odpowiada. mc alias set retryuje samo przez chwile,
log "waiting for minio server..."
tries=0
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "${tries}" -gt 60 ]; then
        log "FATAL: minio nie odpowiada po 60s"
        exit 1
    fi
    sleep 1
done
log "alias 'local' configured"

# --- 2. Bucket ---
log "creating bucket bugshot-backups (idempotent)"
mc mb --ignore-existing local/bugshot-backups

# --- 3. Service account z fixed creds ---
log "creating service account ${BACKUP_ACCESS_KEY_ID} (secret redacted)"
if ! mc admin user svcacct add local "${MINIO_ROOT_USER}" \
        --access-key "${BACKUP_ACCESS_KEY_ID}" \
        --secret-key "${BACKUP_SECRET_ACCESS_KEY}" \
        >/dev/null 2>&1; then
    log "service account exists or add failed (idempotent skip)"
fi

# --- 4. Polityka: read+write tylko na bugshot-backups.
log "writing policy JSON"
cat >/tmp/backup-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": [
        "arn:aws:s3:::bugshot-backups",
        "arn:aws:s3:::bugshot-backups/*"
      ]
    }
  ]
}
EOF

log "attaching policy to service account"
mc admin user svcacct edit local "${BACKUP_ACCESS_KEY_ID}" \
    --policy /tmp/backup-policy.json

# --- 5. Sanity: pokazujemy tylko listy, bez credow ---
log "final buckets:"
mc ls local/

log "DONE"
