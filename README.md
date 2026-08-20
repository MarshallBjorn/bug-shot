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
