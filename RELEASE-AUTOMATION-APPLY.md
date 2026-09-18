# SPR4: Release automation — instrukcja zastosowania

## 1. Branch

```powershell
cd C:\Users\Radek\Documents\GitHub\bug-shot
git checkout main
git pull
git checkout -b feat/release-automation
```

## 2. Rozpakuj overlay do root repo

Rozpakuj `bug-shot-release-automation-overlay.zip`, następnie skopiuj zawartość katalogu
`bug-shot-release-automation-overlay/` do roota repo (nadpisując `.github/workflows/deploy-prod.yaml`
i `.github/workflows/widget.yaml`, dodając resztę jako nowe pliki):

```powershell
robocopy "<rozpakowany>\bug-shot-release-automation-overlay" "C:\Users\Radek\Documents\GitHub\bug-shot" /E
```

## 3. Sprawdź co się zmieniło

```powershell
git status
git diff .github\workflows\deploy-prod.yaml
git diff .github\workflows\widget.yaml
```

Powinny być widoczne: 2 zmodyfikowane pliki, reszta jako nowe (`??` w `git status`).

## 4. Lokalna walidacja (Git Bash, z roota repo)

```bash
# build widgetu
node widget/scripts/build.mjs

# syntax check plikow zrodlowych widgetu
node --check widget/widget.js
node --check widget/mask.js
node --check widget/capture.js
node --check widget/vendor/html-to-image.js

# zawartosc paczki npm (bez publikacji)
cd widget && npm pack --dry-run && cd ..

# parser wersji na REALNEJ historii repo (bez efektu ubocznego)
bash scripts/release/release-dry-run.sh

# skladnia bashowych skryptow release
bash -n scripts/release/compute-version.sh
bash -n scripts/release/release-dry-run.sh
bash -n scripts/release/render-notes.sh

# skladnia YAML (jesli masz Docker)
docker run --rm -v ${PWD}:/repo -w /repo rhysd/actionlint:latest -color
```

Wszystko powyżej musi przejść zielono, zanim zrobisz commit.

## 5. Przejrzyj diff

```powershell
git diff --stat
```

Upewnij się, że NIC poza plikami z `RELEASE-AUTOMATION-MANIFEST.txt` się nie zmieniło.

## 6. Commit

```powershell
git add -A
git commit -m "feat(release): add automated semver release pipeline"
```

## 7. Push

```powershell
git push -u origin feat/release-automation
```

## 8. PR → main

Otwórz PR na GitHubie. Istniejące CI (`backend.yaml`, `frontend.yaml`, `e2e.yaml`, `repo.yaml`,
`widget.yaml`) musi przejść normalnie — `widget.yaml` teraz realnie buduje i pakuje widget
(wcześniej to było martwe, bo `widget/package.json` nie istniał).

## 9. Jednorazowy setup

**Przed mergem** wykonaj wszystko z `RELEASE-AUTOMATION-SETUP.md` (NPM_TOKEN, WIDGET_CDN_BASE_URL,
GHCR visibility, katalog na VPS).

## 10. Merge

Merge PR do `main` (merge commit — bez zmian w strategii). `release.yaml` odpali się
automatycznie i wykona pierwszy prawdziwy release na podstawie Conventional Commits w tym PR-ze.
