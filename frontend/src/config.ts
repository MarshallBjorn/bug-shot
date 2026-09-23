// Runtime configuration.
//
// The production image is built ONCE, environment-agnostic (12-factor). The
// environment-specific values are injected at container start into /config.js
// (see docker-entrypoint.sh + nginx.conf) and exposed on window.__APP_CONFIG__.
//
// Resolution order:
//   1. window.__APP_CONFIG__  — runtime (prod, injected from .env.prod)
//   2. import.meta.env.VITE_* — build-time (local `npm run dev`/`build`)
//   3. localhost default      — bare dev fallback
//
// `||` (not `??`) so an empty string from an unconfigured /config.js also falls through.

const runtimeConfig: AppRuntimeConfig =
  (typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined) ?? {}

export const apiBaseUrl: string =
  runtimeConfig.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const mediaBaseUrl: string =
  runtimeConfig.mediaBaseUrl || import.meta.env.VITE_MEDIA_BASE_URL || apiBaseUrl
