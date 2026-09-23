#!/bin/bash
set -euo pipefail

PORT="${1:-5500}"
API_BASE_URL="${BUGSHOT_API_URL:-http://localhost:8080}"
PROJECT_KEY="${BUGSHOT_PROJECT_KEY:-demo}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# JSON-encode URL zeby cudzyslowy/backslashe w URL nie rozwalily zapisanego JS.
JSON_API_BASE_URL=$(printf '%s' "${API_BASE_URL}" | jq -Rs .)
JSON_PROJECT_KEY=$(printf '%s' "${PROJECT_KEY}" | jq -Rs .)

printf 'window.BUGSHOT_CONFIG = { apiBaseUrl: %s, projectKey: %s };\n' "${JSON_API_BASE_URL}" "${JSON_PROJECT_KEY}" \
    > "${SCRIPT_DIR}/config.js"

python3 -m http.server "${PORT}" --directory "${SCRIPT_DIR}" --bind 127.0.0.1
