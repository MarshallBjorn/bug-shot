#!/bin/sh
set -eu

# Runtime config injection (12-factor).
#
# The SPA reads window.__APP_CONFIG__ from /config.js. We generate that file here,
# at container start, from environment variables (supplied by .env.prod via compose).
# Written to /tmp — a writable tmpfs — because the container runs read_only + non-root
# (user 101), so /usr/share/nginx/html is not writable. nginx serves /config.js from
# /tmp (see nginx.conf).
#
# Values are escaped so a stray quote/backslash/`</` cannot break out of the JS string.

esc() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g; s|</|<\\/|g'
}

cat > /tmp/config.js <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "$(esc "${VITE_API_BASE_URL:-}")",
  mediaBaseUrl: "$(esc "${VITE_MEDIA_BASE_URL:-}")"
};
EOF

exec "$@"
