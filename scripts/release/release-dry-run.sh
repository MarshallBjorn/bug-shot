#!/usr/bin/env bash
# BugShot — release automation
#
# Dry-run: liczy co BYLOBY opublikowane przy nastepnym release, bez zadnego
# efektu ubocznego. Nie tworzy taga, nie publikuje niczego, nie modyfikuje repo.
#
# Uzycie (Git Bash na Windows albo WSL/Linux/macOS):
#   bash scripts/release/release-dry-run.sh
#
# Wymaga: git, bash 4+ (proces substitution). Node/npm/docker NIE sa wymagane
# do samego dry-runu wersji — tylko do pelnej walidacji (patrz APPLY.md).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d .git ]; then
  echo "Uruchom z katalogu glownego repo (tam gdzie jest .git)." >&2
  exit 1
fi

TMP_OUT=$(mktemp)
trap 'rm -f "$TMP_OUT"' EXIT
export GITHUB_OUTPUT="$TMP_OUT"

bash "${SCRIPT_DIR}/compute-version.sh"

SHOULD=$(grep '^should_release=' "$TMP_OUT" | tail -1 | cut -d= -f2)

echo "----------------------------------------"

if [ "$SHOULD" != "true" ]; then
  echo "Wynik: BRAK RELEASE (brak commitow feat/fix/BREAKING CHANGE od ostatniego tagu)."
  exit 0
fi

VER=$(grep '^next_version=' "$TMP_OUT" | tail -1 | cut -d= -f2)
LAST=$(grep '^last_tag=' "$TMP_OUT" | tail -1 | cut -d= -f2)
BUMP=$(grep '^bump=' "$TMP_OUT" | tail -1 | cut -d= -f2)

ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
OWNER_RAW=$(printf '%s' "$ORIGIN_URL" | sed -E 's#.*[:/]([^/]+)/[^/]+(\.git)?$#\1#')
OWNER_LC=$(printf '%s' "${OWNER_RAW:-OWNER}" | tr '[:upper:]' '[:lower:]')

echo "Ostatni tag:              ${LAST:-<brak>}"
echo "Bump:                     ${BUMP}"
echo "Nastepna wersja:          ${VER}"
echo ""
echo "Bylby opublikowany nastepujacy zestaw artefaktow:"
echo "  Git tag:                v${VER}"
echo "  GitHub Release:         v${VER}"
echo "  Docker backend:         ghcr.io/${OWNER_LC}/bugshot-backend:${VER}  (+ :latest)"
echo "  Docker frontend:        ghcr.io/${OWNER_LC}/bugshot-frontend:${VER}  (+ :latest)"
echo "  NPM:                    @bug-shot/widget@${VER}"
echo "  CDN (versioned):        \${WIDGET_CDN_BASE_URL}/widgets/v${VER}/"
echo "  CDN (latest):           \${WIDGET_CDN_BASE_URL}/widgets/latest/"
echo "----------------------------------------"
echo "NIC nie zostalo opublikowane, zaden tag nie zostal utworzony (dry-run)."
