#!/usr/bin/env bash
# BugShot — release automation
#
# Liczy nastepna wersje semver na podstawie Conventional Commits w zakresie
# <ostatni tag v*>..HEAD na main.
#
# Zasady:
#   - ignoruje merge commity (--no-merges) — repo uzywa merge-commit strategy,
#     nie squash, wiec realne feat/fix siedza jako osobne commity w zakresie
#   - NIE parsuje tytulow PR
#   - obsluguje "!" (feat!:, fix!:) oraz "BREAKING CHANGE:" w body jako major
#   - priorytet: major > minor > patch
#   - brak release-worthy commitow -> should_release=false, exit 0 (sukces)
#
# Wyjscie (GITHUB_OUTPUT, jesli ustawiony):
#   should_release=true|false
#   next_version=X.Y.Z      (tylko gdy should_release=true)
#   last_tag=vX.Y.Z          (puste jesli brak tagow)
#   bump=major|minor|patch|none
#
# Uzycie lokalne (bez GITHUB_OUTPUT): wypisuje tylko na stdout.

set -euo pipefail

# tagi postaci vMAJOR.MINOR.PATCH, posortowane semantycznie
LAST_TAG=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null | sort -V | tail -1 || true)

if [ -z "$LAST_TAG" ]; then
  BASE_VERSION="0.0.0"
  RANGE="HEAD"
else
  BASE_VERSION="${LAST_TAG#v}"
  RANGE="${LAST_TAG}..HEAD"
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE_VERSION"

BUMP="none"

# %x01 separuje subject/body, %x02 separuje kolejne commity — bezpieczne
# wobec commit message zawierajacych cudzyslowy, spacje, unicode, backticki
# (nic nie jest eval-owane, tylko porownywane regexem bash).
while IFS= read -r -d $'\x02' entry; do
  subject="${entry%%$'\x01'*}"
  body="${entry#*$'\x01'}"

  is_breaking=false
  if [[ "$subject" =~ ^[a-zA-Z]+(\([^\)]*\))?!:[[:space:]] ]]; then
    is_breaking=true
  elif printf '%s\n' "$body" | grep -qE '^(BREAKING CHANGE|BREAKING-CHANGE): '; then
    is_breaking=true
  fi

  if [ "$is_breaking" = true ]; then
    BUMP="major"
    continue
  fi

  type_token=$(printf '%s' "$subject" | sed -E 's/^([A-Za-z]+)(\([^)]*\))?!?:.*/\1/' | tr '[:upper:]' '[:lower:]')

  if [ "$type_token" = "feat" ]; then
    [ "$BUMP" != "major" ] && BUMP="minor"
  elif [ "$type_token" = "fix" ]; then
    [ "$BUMP" = "none" ] && BUMP="patch"
  fi
done < <(git log "$RANGE" --no-merges --pretty=format:'%s%x01%b%x02' -- . 2>/dev/null || true)

emit() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1" >> "$GITHUB_OUTPUT"
  fi
}

if [ "$BUMP" = "none" ]; then
  emit "should_release=false"
  emit "bump=none"
  emit "last_tag=${LAST_TAG}"
  echo "Zakres:        ${RANGE}"
  echo "Ostatni tag:   ${LAST_TAG:-<brak>}"
  echo "Bump:          none"
  echo "Wynik: brak commitow release-worthy (feat/fix/BREAKING CHANGE) — bez release."
  exit 0
fi

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEXT_VERSION="${MAJOR}.${MINOR}.${PATCH}"

emit "should_release=true"
emit "next_version=${NEXT_VERSION}"
emit "last_tag=${LAST_TAG}"
emit "bump=${BUMP}"

echo "Zakres:          ${RANGE}"
echo "Ostatni tag:     ${LAST_TAG:-<brak>}"
echo "Bump:            ${BUMP}"
echo "Nastepna wersja: ${NEXT_VERSION}"
