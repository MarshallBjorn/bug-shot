#!/bin/bash
set -euo pipefail

PORT="${1:-5500}"
API_BASE_URL="${BUGSHOT_API_URL:-http://localhost:8080}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# JSON-encode URL zeby cudzyslowy/backslashe w URL nie rozwalily zapisanego JS.
JSON_API_BASE_URL=$(printf '%s' "${API_BASE_URL}" | jq -Rs .)

printf 'window.BUGSHOT_CONFIG = { apiBaseUrl: %s };\n' "${JSON_API_BASE_URL}" \
    > "${SCRIPT_DIR}/config.js"

python3 -m http.server "${PORT}" --directory "${SCRIPT_DIR}" --bind 127.0.0.1
