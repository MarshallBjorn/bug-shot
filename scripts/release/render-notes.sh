#!/usr/bin/env bash
# BugShot — release automation
#
# Renderuje finalna tresc GitHub Release:
#   wlasny szablon (Docker/Widget/Upgrade)
#   + natywnie wygenerowane "What's Changed" z linkami do PR
#
# PR-linki generujemy przez bezposrednie wywolanie:
#   POST /repos/{owner}/{repo}/releases/generate-notes
# (ten sam mechanizm co `gh release create --generate-notes`, ale wywolany
# explicite, zeby miec pelna kontrole nad zlozeniem z wlasnym szablonem —
# --generate-notes + --notes-file w `gh release create` NIE laczy obu
# tresci, notes-file nadpisuje generated notes w calosci).
#
# Wymaga: gh (zalogowany, GH_TOKEN w env), jq.
#
# Uzycie:
#   GITHUB_REPOSITORY=owner/repo GITHUB_REPOSITORY_OWNER=owner \
#     bash scripts/release/render-notes.sh <VERSION> <PREV_TAG|none> <CDN_BASE_URL>
#
# Wypisuje finalna tresc release notes na stdout.

set -euo pipefail

VERSION="${1:?Usage: render-notes.sh <VERSION> <PREV_TAG|none> <CDN_BASE_URL>}"
PREV_TAG="${2:?}"
CDN_BASE="${3:?}"

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY env var required (owner/repo)}"
: "${GITHUB_REPOSITORY_OWNER:?GITHUB_REPOSITORY_OWNER env var required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${SCRIPT_DIR}/release-notes-template.md"

OWNER_LC=$(printf '%s' "$GITHUB_REPOSITORY_OWNER" | tr '[:upper:]' '[:lower:]')

# --- wygeneruj "What's Changed" natywnym API GitHuba (PR-linki, autorzy) ---
TARGET_SHA=$(git rev-parse HEAD)

if [ "$PREV_TAG" = "none" ]; then
  GEN_JSON=$(gh api "repos/${GITHUB_REPOSITORY}/releases/generate-notes" \
    -f tag_name="v${VERSION}" \
    -f target_commitish="${TARGET_SHA}")
else
  GEN_JSON=$(gh api "repos/${GITHUB_REPOSITORY}/releases/generate-notes" \
    -f tag_name="v${VERSION}" \
    -f target_commitish="${TARGET_SHA}" \
    -f previous_tag_name="${PREV_TAG}")
fi

GENERATED_BODY=$(printf '%s' "$GEN_JSON" | jq -r '.body')

if [ -z "$GENERATED_BODY" ] || [ "$GENERATED_BODY" = "null" ]; then
  echo "::warning::GitHub generate-notes zwrocilo pusty body — release notes beda mialy tylko wlasny szablon bez sekcji What's Changed." >&2
  GENERATED_BODY="_(GitHub nie wygenerowalo dodatkowych notatek dla tego zakresu — prawdopodobnie brak nowych PR-ow/commitow od ${PREV_TAG})_"
fi

# --- sklej wlasny szablon z wygenerowana tresc ---
# uzywamy awk zamiast bash string-replace, zeby bezpiecznie obsluzyc
# GENERATED_BODY zawierajace znaki specjalne dla sed (/, &, itp.)
TMP_GEN=$(mktemp)
trap 'rm -f "$TMP_GEN"' EXIT
printf '%s' "$GENERATED_BODY" > "$TMP_GEN"

awk -v version="$VERSION" -v owner="$OWNER_LC" -v cdn="$CDN_BASE" -v genfile="$TMP_GEN" '
{
  gsub(/\{\{VERSION\}\}/, version)
  gsub(/\{\{OWNER\}\}/, owner)
  gsub(/\{\{CDN_BASE\}\}/, cdn)
  if (index($0, "{{GENERATED_BODY}}") > 0) {
    while ((getline line < genfile) > 0) print line
    close(genfile)
    next
  }
  print
}
' "$TEMPLATE_FILE"
