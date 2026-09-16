#!/usr/bin/env bash
# verify-zero-downtime.sh — curl in a loop during deploy, fail on any 5xx
# Usage: ./scripts/verify-zero-downtime.sh <url> [duration_seconds]
# Example: ./scripts/verify-zero-downtime.sh https://api-bugshot.on-labs.dev/healthz 120
set -euo pipefail

URL="${1:?Usage: verify-zero-downtime.sh <url> [duration_seconds]}"
DURATION="${2:-120}"
INTERVAL=1

TOTAL=0
FAIL=0
START=$(date +%s)

echo "=== Zero-downtime check: $URL for ${DURATION}s ==="

while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  [ "$ELAPSED" -ge "$DURATION" ] && break

  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$URL" 2>/dev/null || echo "000")
  TOTAL=$((TOTAL + 1))

  if [ "${status:-0}" -ge 500 ] 2>/dev/null || [ "$status" = "000" ]; then
    FAIL=$((FAIL + 1))
    echo "[${ELAPSED}s] ✗ $status"
  fi

  sleep "$INTERVAL"
done

echo "=== Results: $TOTAL requests, $FAIL failures ==="

if [ "$FAIL" -gt 0 ]; then
  echo "FAIL: $FAIL requests returned 5xx/timeout"
  exit 1
fi

echo "PASS: zero 5xx during ${DURATION}s window"
