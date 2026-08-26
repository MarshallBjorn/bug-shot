# BUG-SHOT

## Opis

**Bug-shot** to narzędzie dla automatyzacji pobierania raportów o błędach stron `WWW` oraz pobierania niezbędnej informacji do ich podalszym odtworzeniu.

System dostarcza do użytkownika końcowego, albo `QA` testera możliwość opisania problemu, robi zrzut ekranu i narzędzie pobiera informacji z przegłądarki. Pobrane dane przechodzą walidację i sanityzację, są czyszczone z informacji wrażliwych, po czym trafiają do bazy danych **Bug-shot**. Deweloperzy otrzymują dostęp do pełnego raportu przez osobne `GUI` dla podalszej analizy ta zmianę statusów.

Narzędzie jest dostarczane w formalnie kodu źródłowego oraz publicznego obrazu `Docker`, dostępnego przez `GHCR`.

### Wymagania fukcjonalne
1. Część klienta
    - **Wywołanie GUI:** Użytkownik powinien mieć możliwość otworzyć formularz zgłoszeniowy dla opisania problemu, poprzez przycisk albo plugin.
    - **Zbiór media danych**: System powinien robić zrzut ekranu obecnej strony.
    - **Automatyzacja pobrania danych technicznych:** Skrypt powinien automatycznie dołączać do raportu: adres `URL`, datę i czas, dane przegłądarki `User-Agent`.
    - **Zbiór logów:** Skrypt powinien pobierać logi z przegłądarki użytkownika.
    - **Wysyłanie:** Zebrany pakiet danych powinien być wysyłany poprzez API do serwera.
2. Część serwera
   - **Przyjmowanie danych:** Endpoint `POST` dla przyjmowanie raportów o błądzie.
   - **Ukrywanie danych wrażliwych**: Przed zapisaniem do bazy danych, system powinien ukrywać dane wrażliwe i podmieniać je na `***`.
   - **CRUD dla panelu:** Dostarczenie `API` dla czytania listy ticketów, przegłądanie szczegółów, dodawanie komentarzy i aktualizacji statusów.
3. Panel administratorski
   - **Przegłąd:** Zespół deweloperów powinien otrzymawać pełny raport w wygłądzie jednolitego `GUI`, z możliwość szczególnego badania osobnych elementów.
   - **Nawigacja:** Możliwość szukania, filtracja i paginacji złożonych tiketów.
   - **Aktualizacja:** Możliwość zmiany statusu tiketów. 
   - **Komunikacja:** Możliwość pozostawiania komentarzy do tiketu i przegłądania jego historii.

### Wymagania niefunkcjonalne
- **Bezpieczeństwo:** Dane wrażliwe nie mogą być przechowywane w bazie danych w formmie otwartej. 
- **Kompatybilność:** `API` backendu ma odpowiednio przyjmować `Cross-Origin` `POST` żądania, żeby zgłoszenie mogło poprawie działać na zewnętrznych domenach. 
- **Infrastruktura:** Projekt ma być odtwarzalnym i być diagnozowalnym przy pomocy narzędzia `docker-compose`.
- **Przechowywanie danych:** Zrzuty ekranu oraz inne pliki media, powinny być przechowywane w formie plików w nginx + `Docker Volume`, albo `S3`-kompatybilnej przestrzeni, baza danych przechowuje jedynie `URI` do nich.
- **Jakość kodu:** Kod, dane i dokumentacja powinny być przydatnym do daleszego rozwoju i utrzymania. 
- **Automatyzacja:** Zbieranie obrazów oraz sprawdzanie ma być automatyzowane.

### Stack technologiczny

```
Frontend: React
Backend: .NET
Baza danych: PostgreSQL
Konteneryzacja: Docker + docker-compose
CI/CD: GitHub Actions
```

## Architektura

```mermaid
flowchart LR
    subgraph client["Strona klienta (cudza domena)"]
        widget["Widget<br/>@bug-shot/widget<br/>ESM / CDN"]
    end

    subgraph edge["Edge / Reverse proxy"]
        caddy["Caddy<br/>HTTPS + Let's Encrypt"]
    end

    subgraph app["Aplikacja (docker-compose)"]
        api[".NET Web API<br/>BugShot.Api"]
        dashboard["React Dashboard<br/>panel administracyjny"]
        nginx["nginx<br/>serwowanie mediów"]
    end

    subgraph data["Warstwa danych"]
        pg[("PostgreSQL<br/>tickets, comments,<br/>projects, sanitization")]
        vol[("Docker volume<br/>screenshoty, logi,<br/>załączniki")]
    end

    subgraph external["Zewnętrzne"]
        turnstile["Cloudflare Turnstile<br/>opt-in per projekt"]
        s3["S3 / B2<br/>backupy pg_dump + wolumen"]
    end

    subgraph cicd["CI/CD"]
        gh["GitHub Actions"]
        ghcr["GHCR<br/>obrazy: api, dashboard, nginx"]
        npm["NPM + jsDelivr<br/>widget"]
    end

    dev(["Developer / QA"])
    admin(["Admin projektu"])

    widget -- "POST /tickets<br/>X-ProjectKey + Origin<br/>+ Idempotency-Key<br/>+ Turnstile token" --> caddy
    widget -- "POST /tickets/{id}/attachments" --> caddy
    caddy --> api
    caddy --> dashboard
    caddy --> nginx

    api -- "walidacja Origin<br/>rate limit<br/>sanityzacja" --> pg
    api -- "zapis plików" --> vol
    api -. "walidacja tokena" .-> turnstile
    nginx -- "serwowanie<br/>Content-Disposition: attachment" --> vol

    admin -- "CRUD projektów<br/>rotacja klucza<br/>reguły sanityzacji" --> dashboard
    dev -- "przegląd ticketów<br/>komentarze, statusy" --> dashboard
    dashboard -- "REST" --> api

    gh -- "test + build + scan" --> ghcr
    gh -- "publish tag widget-v*" --> npm
    ghcr -- "docker compose pull" --> app
    npm -.-> widget

    pg -. "pg_dump cron" .-> s3
    vol -. "archiwum tygodniowe" .-> s3

    classDef ext fill:#2a2a2a,stroke:#888,color:#ddd
    classDef data fill:#1a3a5a,stroke:#4a8ab0,color:#fff
    classDef app fill:#1a4a2a,stroke:#4ab070,color:#fff
    class turnstile,s3,ghcr,npm,gh ext
    class pg,vol data
    class api,dashboard,nginx,caddy app
```

**Legenda przepływów:**
- Ciągła strzałka — runtime request (użytkownik → system)
- Kropkowana — asynchroniczna albo warunkowa (backup, opcjonalny Turnstile, publikacja artifactu)

**Uwagi:**
- Widget jest jedynym komponentem żyjącym poza naszą infrastrukturą — na cudzej domenie, dostarczany przez CDN
- Baza trzyma tylko `uri` do plików, same pliki na wolumenie serwowane przez nginx bezpośrednio (API ich nie proxuje)
- Rate limit i walidacja `Origin` są w API, nie na Caddy — łatwiej ich odpalać per-endpoint
- Turnstile podłączany warunkowo per projekt (flaga w `projects`)
