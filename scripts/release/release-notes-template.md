## Docker Images

| Image | Tag |
|---|---|
| `ghcr.io/{{OWNER}}/bugshot-backend` | `{{VERSION}}`, `latest` |
| `ghcr.io/{{OWNER}}/bugshot-frontend` | `{{VERSION}}`, `latest` |

Obrazy zretagowane z już przeskanowanego (Trivy/Dockle w CI) obrazu SHA — nie są przebudowywane przy release, więc `{{VERSION}}` i `latest` wskazują na dokładnie ten sam digest, co obraz z main.

## Widget

- NPM: [`@bug-shot/widget@{{VERSION}}`](https://www.npmjs.com/package/@bug-shot/widget/v/{{VERSION}})
- CDN (wersja zablokowana, cache 1 rok): `{{CDN_BASE}}/widgets/v{{VERSION}}/widget.js`
- CDN (latest, cache 5 min): `{{CDN_BASE}}/widgets/latest/widget.js`

## Upgrade

Produkcja aktualizuje się **automatycznie** — ten tag odpala `deploy-prod.yaml`, który:
1. pobiera już opublikowane obrazy `bugshot-backend:{{VERSION}}` / `bugshot-frontend:{{VERSION}}` z GHCR (bez rebuildu),
2. robi rolling update service po service z health-checkiem,
3. uruchamia smoke test + Playwright smoke,
4. automatycznie rollbackuje do poprzedniej wersji, jeśli smoke test padnie.

Migracje EF Core uruchamiają się automatycznie przy starcie `backend` — bez ręcznego kroku.

Ręczna/DR ścieżka aktualizacji (gdy automatyczny deploy nie zadziała) opisana w `docs/deployment.md` → sekcja "Upgrade path".

---

{{GENERATED_BODY}}
