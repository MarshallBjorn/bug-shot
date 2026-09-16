#!/usr/bin/env bash
# smoke-test.sh — run locally on VPS after deploy
# Usage: ./scripts/smoke-test.sh [staging|prod]
set -euo pipefail

ENV="${1:-staging}"

if [ "$ENV" = "staging" ]; then
  API_URL="${STAGING_API_URL:-http://localhost:8080}"
  APP_URL="${STAGING_APP_URL:-http://localhost:3000}"
else
  API_URL="${PROD_API_URL:-http://localhost:8080}"
  APP_URL="${PROD_APP_URL:-http://localhost:3000}"
fi

FAIL=0

echo "=== Smoke tests: $ENV ==="

# 1. Healthz endpoints
for url in "$API_URL/healthz" "$APP_URL/healthz"; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "000")
  if [ "$status" = "200" ]; then
    echo "✓ $url → $status"
  else
    echo "✗ $url → $status"
    FAIL=1
  fi
done

# 2. API doesn't return 5xx
status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$API_URL/api/v1/health" 2>/dev/null || echo "000")
if [ "${status:-0}" -lt 500 ] 2>/dev/null; then
  echo "✓ API /api/v1/health → $status"
else
  echo "✗ API /api/v1/health → $status (5xx)"
  FAIL=1
fi

# 3. Frontend serves HTML
content_type=$(curl -sS -o /dev/null -w '%{content_type}' --max-time 10 "$APP_URL/" 2>/dev/null || echo "")
if echo "$content_type" | grep -qi "text/html"; then
  echo "✓ Frontend serves HTML"
else
  echo "✗ Frontend content-type: $content_type"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "=== All smoke tests passed ==="
else
  echo "=== SMOKE TESTS FAILED ==="
  exit 1
fi
