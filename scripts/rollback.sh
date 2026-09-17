#!/usr/bin/env bash
# rollback.sh — manual rollback on VPS
# Usage: ./scripts/rollback.sh <version> [owner]
# Example: ./scripts/rollback.sh 1.2.3 myorg
set -euo pipefail

VERSION="${1:?Usage: rollback.sh <version> [owner]}"
VERSION="${VERSION#v}"
OWNER="${2:-$(cat .deploy-owner 2>/dev/null || echo 'marshallbjorn')}"
OWNER=$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')

cd ~/bugshot

echo "=== Rollback to v${VERSION} ==="

for SERVICE in backend frontend; do
  IMAGE="ghcr.io/${OWNER}/bugshot-${SERVICE}:${VERSION}"
  echo "Pulling $IMAGE ..."
  docker pull "$IMAGE"
done

export BACKEND_IMAGE="ghcr.io/${OWNER}/bugshot-backend:${VERSION}"
export FRONTEND_IMAGE="ghcr.io/${OWNER}/bugshot-frontend:${VERSION}"

cat .deploy-tag > .deploy-tag-prev 2>/dev/null || true
echo "$VERSION" > .deploy-tag

docker compose --env-file .env.prod \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --no-build --remove-orphans

echo "Waiting for services to be healthy..."
timeout 120 bash -c '
  until docker compose --env-file .env.prod \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    ps --format json | \
    python3 -c "
import sys, json
lines = sys.stdin.read().strip().split(chr(10))
svcs = [json.loads(l) for l in lines if l.strip()]
healthy = all(s.get(\"Health\",\"healthy\") == \"healthy\" for s in svcs if s.get(\"Health\"))
sys.exit(0 if healthy else 1)
"; do
    sleep 5
  done
'

echo "=== Rollback to v${VERSION} complete ==="
echo "Run: ./scripts/smoke-test.sh prod"
