// Runtime configuration placeholder.
//
// Dev / local build: served as-is — empty config, so src/config.ts falls back to
// import.meta.env.VITE_* and finally the localhost default.
//
// Production: the container entrypoint (docker-entrypoint.sh) overwrites the served
// /config.js with values from the environment (.env.prod) at startup. This file in
// dist/ is shadowed by nginx (location = /config.js -> /tmp/config.js).
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
