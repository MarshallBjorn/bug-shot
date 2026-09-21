# SPR4: Release automation — jednorazowy setup

Wykonaj raz, przed pierwszym mergem `release.yaml` do `main`.

## 1. Sekret: `NPM_TOKEN` (nowy)

1. npmjs.org → zaloguj się na konto/organizację, która ma (lub założy) scope `@bug-shot`.
2. Jeśli scope `@bug-shot` jeszcze nie istnieje: **Add Organization** → nazwa `bug-shot`.
3. Account → **Access Tokens** → **Generate New Token** → **Granular Access Token**:
   - Packages and scopes: `@bug-shot` → **Read and write**
   - Expiration: wg polityki zespołu
4. GitHub repo → **Settings → Secrets and variables → Actions → Secrets → New repository secret**
   - Name: `NPM_TOKEN`
   - Value: token z kroku 3

## 2. Zmienna: `WIDGET_CDN_BASE_URL` (nowa)

GitHub repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**
- Name: `WIDGET_CDN_BASE_URL`
- Value: `https://fs-bugshot.on-labs.dev`

**Skąd ta wartość:** to jest literalna reguła Traefika w `docker-compose.prod.yml`:
`traefik.http.routers.bugshot-static.rule=Host(\`fs-bugshot.on-labs.dev\`)`. To jest jedyne
miejsce w kodzie, które definiuje faktyczny routing do kontenera nginx serwującego `/widgets/`.

⚠️ **Rozbieżność do sprawdzenia**: `docs/deployment.md` w dwóch miejscach opisuje ten sam
subdomain jako `fs.bugshot.on-labs.dev` (kropka zamiast myślnika) — to najprawdopodobniej
nieaktualna literówka w dokumentacji, bo kod (Traefik label) jest jednoznaczny i to on
faktycznie decyduje, co odpowiada. Przed pierwszym release'em zrób jednorazowo:
```
curl -I https://fs-bugshot.on-labs.dev/widgets/
```
i potwierdź że odpowiada (200/403/404 z nginx — nie timeout/DNS error). Jeśli nie odpowiada,
popraw wartość zmiennej na faktycznie działający hostname — **nie zgaduj, zweryfikuj przed
pierwszym release'em**, bo `widget-cdn` job i tak sam z siebie nie sprawdza HTTP, tylko robi
SSH+rsync bezpośrednio na hosta (dlatego to jednorazowe `curl` jest ważne, żeby wiedzieć, że
DNS/Traefik faktycznie wystawia to na świat).

## 3. GHCR — widoczność publiczna (`bugshot-backend`, `bugshot-frontend`)

Aktualnie: workflow ma `packages: write`, ale to **nie ustawia widoczności** — nowy package
tworzony przez `GITHUB_TOKEN` domyślnie jest **prywatny**.

Dla każdego z dwóch package'ów:
1. `github.com/<owner>?tab=packages` → otwórz `bugshot-backend`
2. **Package settings** (prawy dolny róg strony package'a)
3. **Danger Zone → Change visibility → Public** → potwierdź nazwą package'a
4. Powtórz dla `bugshot-frontend`

Jeśli package jeszcze nie istnieje (bo `_image.yaml` jeszcze nigdy nie zbudował danego
serwisu) — wróć do tego kroku po pierwszym pushu do `main`, który dotknie `backend/**` lub
`frontend/**`.

`bugshot-backup` **zostaje prywatny** — to wewnętrzny obraz operacyjny, nie produktowy;
release automation świadomie go nie wersjonuje semver-em (patrz `RELEASE-AUTOMATION-MANIFEST.txt`).

## 4. Katalog widgetu na VPS

`docker-compose.yml` montuje `./bug-shot-widgets:/srv/widgets:ro` do kontenera nginx.
Katalog musi istnieć na hoście **przed** pierwszym `widget-cdn` jobem:

```bash
ssh vps "mkdir -p ~/bugshot-prod/bug-shot-widgets"
```

(host/user do SSH — te same co już używane przez `deploy-prod.yaml`/`wg-connect`, sekret
`WG_VPS_ADDRESS` / alias `vps` w SSH configu runnera).

## 5. Sekrety, które JUŻ ISTNIEJĄ — nie twórz ponownie

Reużyte bez zmian, bo są już używane przez `deploy-prod.yaml` / `deploy-staging.yaml` / `rollback.yaml`:

- `WG_PRIVATE_KEY`
- `WG_ENDPOINT`
- `WG_PEER_PUBLIC_KEY`
- `WG_RUNNER_ADDRESS`
- `WG_VPS_ADDRESS`
- `DEPLOY_SSH_KEY`
- `DISCORD_WEBHOOK_URL`
- `GITHUB_TOKEN` (wbudowany, automatyczny)

## 6. Branch protection na `main`

Sprawdź (nie zmieniaj, jeśli już tak jest): `release.yaml` triguje się na `push` do `main`,
czyli **po** mergu PR — nie powinien być dodawany jako "required status check" na `main`
(i tak nie zdąży się wykonać przed mergem). Bez akcji, jeśli nikt go tam ręcznie nie doda.
