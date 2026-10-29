# SprintLog

[![CI](https://github.com/took1s/SprintLog/actions/workflows/ci.yml/badge.svg)](https://github.com/took1s/SprintLog/actions/workflows/ci.yml)

**Hybrid Fitness Tracker** - eine offline-fähige Progressive Web App (PWA), die Krafttraining und Feldtraining (Fußball, Sprints, Sprünge) in einer Anwendung vereint.

Live-Demo: https://sprintlog-api.onrender.com/

> Projekt im 1. Ausbildungsjahr - Fachinformatiker für Anwendungsentwicklung.

| Übungen | Satz + Technik (Kraft) | Satz + Technik (Feld) | Einheit prüfen |
| --- | --- | --- | --- |
| ![Übungen](docs/screenshots/gym.webp) | ![Kraft](docs/screenshots/set-gym.webp) | ![Feld](docs/screenshots/set-field.webp) | ![Session](docs/screenshots/session.webp) |

| Spiel eintragen | Täglicher Check-in | Trainingsplan | Vorlagen mit Quellen |
| --- | --- | --- | --- |
| ![Spiel](docs/screenshots/match.webp) | ![Check-in](docs/screenshots/checkin.webp) | ![Plan](docs/screenshots/plan.webp) | ![Vorlagen](docs/screenshots/templates.webp) |

| Überblick | Historie | Fortschritt | Kalender |
| --- | --- | --- | --- |
| ![Überblick](docs/screenshots/overview.webp) | ![Historie](docs/screenshots/history.webp) | ![Fortschritt](docs/screenshots/progress.webp) | ![Kalender](docs/screenshots/calendar.webp) |

--- | --- | --- | --- |
| ![Übungen](docs/screenshots/gym.webp) | ![Kraft](docs/screenshots/set-gym.webp) | ![Feld](docs/screenshots/set-field.webp) | ![Überblick](docs/screenshots/overview.webp) |

| Historie | Fortschritt | Kalender | Einheit prüfen |
| --- | --- | --- | --- |
| ![Historie](docs/screenshots/history.webp) | ![Fortschritt](docs/screenshots/progress.webp) | ![Kalender](docs/screenshots/calendar.webp) | ![Session](docs/screenshots/session.webp) |

---

## Inhalt

- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Architektur](#architektur)
- [Lokal starten](#lokal-starten)
- [Tests und CI](#tests-und-ci)
- [Datenbank und Migrationen](#datenbank-und-migrationen)
- [Betrieb und Automatisierung](#betrieb-und-automatisierung)
- [API](#api)
- [Projektstruktur](#projektstruktur)
- [Herausforderungen und Lösungen](#herausforderungen-und-lösungen)
- [Ausblick](#ausblick)

## Features

**Training erfassen**
- Drei Erfassungsarten pro Übung: *Gewicht × Wiederholungen*, *Distanz + Zeit* (Sprints, Shuttles) und *Dauer* (Plank, Seilspringen).
- Live-Telemetrie beim Kraftsatz: geschätztes 1RM (Epley), Intensität in % vom Rekord, Trainingszone; Schnellwahl 70/80/90 % vom Rekord.
- Live-Telemetrie beim Sprint: km/h, m/s und Vergleich mit der eigenen Bestgeschwindigkeit.
- Vorbelegung mit dem letzten Satz, Pausentimer mit Ton und Vibration (läuft auch nach Neuladen korrekt weiter), Bildschirm bleibt während der Einheit an.
- Eigene Übungen (nur für den eigenen Account sichtbar), Favoriten, Suche, Filter und Sortierung.
- Pro Satz RPE (6-10 in halben Schritten) oder wahlweise RIR (Wdh. in Reserve, gespeichert als RPE), Aufwärmsätze und eine Notiz (z. B. "Knie ok") - Aufwärmsätze zählen nicht für Rekorde, Volumen und Verläufe.
- Abschluss-Dialog mit Session-RPE (Borg CR-10), Notiz, Datum und Dauer -> Trainingslast nach Foster (sRPE × Minuten) im Wochendiagramm.
- Einheiten nachträglich bearbeiten (auch offline - die Änderung wird per `PUT` synchronisiert).
- Technik-Ansicht pro Übung: animierte Figur (eigene SVG-Skelettanimation, offline, ~65 Bewegungsmuster für alle 130 Standardübungen, eigene Übungen werden über den Namen erkannt), Zielmuskulatur und 3-4 Technik-Hinweise.

**Fußball**
- Spiele eintragen (Minuten, Session-RPE, Tore, Vorlagen, Gegner) - ohne Sätze, aber mit Trainingslast (Minuten × RPE), sodass Spiele in die Belastungssteuerung eingehen.
- Täglicher Check-in nach dem Wellness-Fragebogen von McLean et al. (2010): Schlaf, Energie, Muskeln, Stimmung (je 1-5) -> Bereitschaft in %, 14-Tage-Verlauf und eine Empfehlung zusammen mit der Belastung (z. B. niedrige Bereitschaft oder Lastspitze -> leichter Tag).

**Trainingspläne**
- 16 Vorlagen aus Studien und bewährten Programmen, jeweils mit Quelle in der App:
  - Fußball & Prävention: FIFA 11+ (Soligard 2008, BMJ), Nordic-Hamstring-Protokoll + Copenhagen-Adduktoren-Programm (van der Horst 2015, Harøy 2019), Ausdauer-Intervalle 4×4 (Helgerud 2001), Repeated Sprint Ability (Bishop 2011), Plyometrie, Fußball-Kraft 2x, Speed & Agility.
  - Gym: 5×5 lineare Progression, GZCLP, 5/3/1 Boring But Big, PHUL, Upper/Lower 4x, Push/Pull/Legs, Ganzkörper für Einsteiger, Geräte-Ganzkörper (nach ACSM-Empfehlung für Einsteiger), Körpergewicht-Routine.
  - Daten in einer Datei: [`SprintLog.Api/Data/program-templates.json`](SprintLog.Api/Data/program-templates.json) (API, Mock-Backend und Tests lesen dieselbe Datei; jede Vorlage wird mit der API-Validierung geprüft).
- Periodisierung: Wochen-Stufen pro Übung (z. B. Nordic: Woche 1 2×5 -> ab Woche 5 3×12/10/8), Wochen-Zyklus (5/3/1: 4-Wochen-Wellen) und automatische Entlastungswochen (~60 % der Sätze, -10 % Gewicht).
- Gewichtsvorschlag: Double Progression (erst das obere Ende des Wdh.-Bereichs in allen Sätzen, dann +Steigerung) oder prozentbasiert vom besten geschätzten 1RM der letzten 120 Tage.
- "Next up": der nächste Tag rotiert automatisch; Start eines Tages lädt die Vorgaben der aktuellen Woche (Sätze, Wdh., Pause, Ziel-RPE, Hinweise) als Checkliste. Eigener Editor inkl. Wochen-Stufen.
- Belastungssteuerung: Acute:Chronic Workload Ratio (7 Tage vs. 28-Tage-Schnitt) mit Zonen (Sweet Spot 0.8-1.3, Spike > 1.5), Spiele eingeschlossen.
- Fortschritt im Plan: geschätztes 1RM der Kraftübungen zu Beginn vs. letzte 3 Wochen.
- 130 Standard-Übungen (inkl. Maschinen, Multipresse, Kabelzug und Cardio-Geräte), alle mit animierter Technik-Figur (SVG, eigene Skelett-Animation) und Technik-Hinweisen in drei Sprachen.

**Auswertungen**
- Überblick: Einheiten und Volumen dieser Woche (mit Vergleich zur Vorwoche), Wochen-Serie, 12-Wochen-Diagramm, Muskelgruppen-Verteilung, letzte Rekorde.
- Fortschritt pro Übung: Max-Gewicht, geschätztes 1RM, Volumen bzw. Top-Speed, Bestzeit, Distanz.
- Historische Rekorde: ein Satz bekommt ein Badge, wenn er zum Zeitpunkt des Trainings den bisherigen Bestwert übertroffen hat.
- Aktivitäts-Heatmap (26 Wochen) und Rekordliste.

**Offline-first und Daten**
- Die App startet ohne Netz (Service Worker). Einheiten werden immer zuerst lokal gespeichert und automatisch synchronisiert.
- Idempotente Synchronisation über eine Client-ID: abgebrochene oder doppelte Sync-Versuche erzeugen keine Duplikate.
- Export als CSV (Excel-kompatibel) und JSON, Löschen des Accounts inkl. aller Daten (DSGVO Art. 17 und 20).
- Keine externen CDNs: Vue, Chart.js, Tailwind-CSS und die Schrift werden mitgebaut und selbst ausgeliefert (offline-fähig, keine Datenübertragung an Dritte).
- Oberfläche auf Englisch, Deutsch und Russisch: Sprache wird aus dem Browser erkannt und lässt sich in den Einstellungen wechseln. Standard-Übungen, Vorlagen und Technik-Hinweise sind übersetzt, Zahlen und Datum folgen der Sprache (z. B. `1,5 kg`). Russische Pluralformen über `Intl.PluralRules`.
- Strikte Content-Security-Policy (`script-src 'self'`, kein `unsafe-eval`, kein `unsafe-inline`): Templates werden zur Build-Zeit kompiliert.

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| Backend | C# / .NET 8 Minimal API, Entity Framework Core 8 |
| Datenbank | PostgreSQL (Supabase in Produktion, Docker lokal) |
| Auth | httpOnly-Cookies (Access-JWT 15 min + rotierender Refresh-Token), Bearer-JWT für API-Clients, BCrypt, Rate Limiting |
| Frontend | Vue 3 (Single-File Components, `<script setup>`), TypeScript (strict), Pinia, Vite, Tailwind CSS, Chart.js |
| Tests | xUnit + WebApplicationFactory + Testcontainers (echtes PostgreSQL), Vitest, vue-tsc, Playwright (E2E) |
| CI/CD | GitHub Actions, Docker, Render |

## Architektur

```mermaid
flowchart LR
    subgraph Browser["Browser / PWA"]
        UI["Vue 3 UI"] --> Q["Sync-Queue<br/>(localStorage)"]
        UI --> C["Cache<br/>Übungen, Historie"]
        SW["Service Worker<br/>App-Shell offline"]
    end
    Q -- "POST /api/workouts<br/>clientId (idempotent)" --> API
    UI -- "JWT" --> API["ASP.NET Core 8<br/>Minimal API"]
    API --> EF["EF Core"] --> DB[("PostgreSQL")]
```

Ablauf beim Speichern einer Einheit:

1. Die Einheit bekommt im Browser eine `clientId` (UUID) und das Startdatum und landet in der Queue.
2. Online wird sie an `POST /api/workouts` gesendet. Der Server prüft Eingaben und Übungs-IDs und speichert Einheit + Sätze in einer Transaktion.
3. Existiert die `clientId` für diesen Nutzer schon (z. B. weil die Antwort verloren ging), liefert der Server die vorhandene Einheit zurück statt sie doppelt anzulegen. Ein Unique-Index `(UserId, ClientId)` sichert das auch bei parallelen Requests ab.
4. Validierungsfehler markieren den Eintrag als fehlgeschlagen (sichtbar in der Historie mit "Retry"), Netzwerk- und Serverfehler werden später automatisch wiederholt.

Laden der Historie (Delta-Sync): Beim ersten Start holt die App alle Einheiten seitenweise über `GET /api/workouts/changes` und speichert sie lokal. Danach fragt sie nur noch `?since=<syncToken>` ab und bekommt neue/bearbeitete Einheiten plus die IDs gelöschter Einheiten (Grabsteine in `DeletedWorkouts`). Auch bei hunderten Einheiten wird so pro Start nur übertragen, was sich geändert hat. Der Token überlappt um 2 Minuten, damit keine Änderung aus einer gerade laufenden Transaktion verloren geht; das Zusammenführen per ID ist idempotent.

Anmeldung und Sitzung:

- Die Browser-App bekommt keine Tokens zu sehen: Access-Token (JWT, 15 min, Pfad `/api`) und Refresh-Token (30 Tage gleitend, Pfad `/api/auth`) liegen in `httpOnly`-, `SameSite=Strict`-Cookies. Ein XSS-Angriff kann so keine Sitzung stehlen.
- Bei `401` erneuert der Client die Sitzung automatisch (ein Refresh für alle parallelen Requests) und wiederholt den Request. Jeder Refresh rotiert den Refresh-Token; wird ein bereits ersetzter Token später erneut benutzt (Diebstahl), widerruft der Server die ganze Sitzung.
- CSRF: Schreibende Requests mit Cookie zählen nur mit dem Header `X-Requested-With: SprintLog`, den eine fremde Seite ohne CORS-Freigabe nicht setzen kann.
- Jeder Token trägt eine Token-Version. Passwort ändern/zurücksetzen und "Überall abmelden" erhöhen sie - alte Tokens sind sofort ungültig.
- API-Clients ohne diesen Header (Swagger, Skripte, Tests) bekommen wie bisher einen Bearer-Token im Body.
- Passwort vergessen: 10 Wiederherstellungscodes bei der Registrierung (einmal sichtbar, jederzeit neu erzeugbar) und optional ein Reset-Link an die bestätigte E-Mail (Brevo). Codes und Links werden nur als HMAC gespeichert.

Datenisolation: Jeder Endpunkt liest die Nutzer-ID aus dem JWT. Fremde Einheiten und Übungen liefern `404` (nicht `403`), damit keine IDs erraten werden können.

## Lokal starten

### Variante A: Docker (empfohlen, inkl. Datenbank)

Voraussetzung: [Docker Desktop](https://www.docker.com/).

```bash
git clone https://github.com/took1s/SprintLog.git
cd SprintLog
cp .env.example .env        # JWT_SECRET setzen (mind. 32 Zeichen)
docker compose up --build
```

- App: http://localhost:5111
- Swagger: http://localhost:5111/swagger
- Health-Check: http://localhost:5111/health

Die Migrationen werden beim Start automatisch angewendet (`Database__MigrateOnStartup=true`).

### Variante B: .NET direkt (z. B. gegen Supabase)

```bash
# .env im Repo-Ordner mit ConnectionStrings__DefaultConnection und JWT_SECRET (siehe .env.example)
cd SprintLog.Api
dotnet run
```

Das Frontend muss dafür einmal gebaut werden (`npm ci && npm run build`, Ausgabe nach `SprintLog.Api/wwwroot`).

### Variante C: Frontend-Entwicklung mit Hot Reload

```bash
npm ci
npm run mock:demo     # Mock-API auf http://localhost:5111 (Login: demo / demo-password, 10 Wochen Demo-Daten)
npm run dev           # Vite auf http://localhost:5173, /api wird an :5111 weitergeleitet
```

Statt der Mock-API kann auch die echte API laufen (`dotnet run`, ebenfalls Port 5111).

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Vite-Dev-Server mit Hot Module Replacement |
| `npm run build` | Typprüfung (`vue-tsc`) + Produktions-Build nach `SprintLog.Api/wwwroot` |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:e2e` | Browser-Tests (Playwright) gegen den Build und die Mock-API |

### Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `ConnectionStrings__DefaultConnection` | ja | PostgreSQL-Connection-String |
| `JWT_SECRET` | ja | Signierschlüssel, mindestens 32 Byte |
| `Database__MigrateOnStartup` | nein | `true` = Migrationen beim Start anwenden (Standard: `false`) |
| `Swagger__Enabled` | nein | Swagger auch außerhalb von Development anzeigen |
| `RateLimiting__AuthPermitLimit` | nein | Login-/Registrierungsversuche pro Minute und IP (Standard: 10) |
| `BREVO_API_KEY` | nein | API-Key von [Brevo](https://www.brevo.com) für E-Mails (Passwort-Reset). Ohne Key: nur Wiederherstellungscodes |
| `Email__From` | mit Brevo | Absenderadresse (in Brevo als Sender bestätigt) |
| `Email__FromName` | nein | Absendername (Standard: SprintLog) |
| `App__PublicUrl` | mit Brevo | Öffentliche URL für Links in E-Mails, z. B. `https://sprintlog-api.onrender.com` |
| `Jwt__AccessTokenMinutes` / `Jwt__RefreshTokenDays` | nein | Lebensdauer der Cookie-Sitzung (Standard: 15 min / 30 Tage) |
| `SENTRY_DSN` | nein | DSN eines [Sentry](https://sentry.io)-Projekts: Server- und Browser-Fehler mit Stacktrace. Ohne DSN: nur Logs |
| `SENTRY_BROWSER_DSN` | nein | Eigenes Sentry-Projekt für Browser-Fehler (Standard: `SENTRY_DSN`) |
| `Sentry__TracesSampleRate` | nein | Anteil der Requests mit Performance-Tracing, z. B. `0.1` (Standard: 0 = aus) |
| `Logging__Format` | nein | `json` = Logs als kompaktes JSON (für Log-Dienste), sonst lesbarer Text |

In der Cloud (Render) werden die Werte im Dashboard unter *Environment* hinterlegt.

### Logs und Fehler-Monitoring

- **Serilog** schreibt strukturierte Logs auf die Konsole (in Render unter *Logs*): eine Zeile pro API-Request mit Methode, Pfad, Status, Dauer, Nutzer-ID und App-Version (`X-Client-Version`). `/health` und statische Dateien werden nicht geloggt.
- Sicherheitsereignisse haben das Präfix `Security:` - fehlgeschlagene Anmeldung, Passwortwechsel (mit Weg: Einstellungen, Code, E-Mail) und die Wiederverwendung eines bereits rotierten Refresh-Tokens (Hinweis auf einen gestohlenen Token, die Sitzung wird beendet). Benutzernamen, E-Mails und IPs stehen nicht in den Logs.
- **Sentry** (optional): Mit `SENTRY_DSN` landen Server-Fehler (Level *Error*) samt Stacktrace, Release (Git-Commit von Render) und Nutzer-ID in Sentry; Info-Logs werden als Breadcrumbs mitgeschickt. Keine IPs, Cookies, Header mit Tokens oder Request-Bodys.
- Browser-Fehler: Die Web-App lädt das Sentry-SDK (38 KB gzip) nur nach, wenn `/api/config` einen DSN liefert, und schickt Meldungen über den eigenen Endpunkt `/api/monitoring/tunnel`. So bleibt die CSP bei `connect-src 'self'`, Werbeblocker stören nicht, und der Server leitet nur an das eigene Projekt weiter (kein offener Proxy, max. 256 KB, 30 Meldungen pro Minute und IP). URLs gehen ohne Query an Sentry - dort stehen die Einmal-Tokens von Reset- und Bestätigungslinks.

Sentry einrichten (kostenlos, 5.000 Fehler pro Monat): Konto auf sentry.io anlegen, Projekt mit Plattform *ASP.NET Core* erstellen, unter *Settings -> Client Keys (DSN)* den DSN kopieren und in Render als `SENTRY_DSN` eintragen. Die Source Maps liegen öffentlich neben den Skripten, Sentry lädt sie für lesbare Browser-Stacktraces selbst.

## Tests und CI

```bash
dotnet test                 # Integrationstests gegen echtes PostgreSQL (Docker muss laufen)
npm run build               # Typprüfung (TypeScript strict, auch die Vue-Templates) + Build
npm test                    # Unit-Tests (Vitest): Kennzahlen, Rekorde, Sync-Queue, Delta-Sync, Pläne, CSV-Export
npm run test:e2e            # Browser-Tests (Playwright) inkl. Offline-Modus und CSP-Prüfung
```

Die Integrationstests starten die echte API mit `WebApplicationFactory` und eine PostgreSQL-Instanz mit Testcontainers. Getestet werden unter anderem:

- Registrierung, Login, Token-Refresh, gefälschte Tokens, Rate Limiting
- Datenisolation zwischen Nutzern (Einheiten, eigene Übungen, Favoriten)
- Idempotentes Speichern (auch 5 parallele Requests mit derselben `clientId`)
- Validierung (negative Werte, Zukunftsdatum, unbekannte Übungen, leere Einheiten)
- Zeitzonen (Datum mit Offset wird als UTC gespeichert)
- Account löschen mit allen Daten

GitHub Actions führt bei jedem Push aus: Build, Prüfung "EF-Modell passt zu den Migrationen", Backend-Tests, Typprüfung und Build des Frontends, Unit- und E2E-Tests sowie den Docker-Build.

## Datenbank und Migrationen

Die Migrationen liegen in `SprintLog.Api/Migrations`. Für Umgebungen ohne direkten Datenbankzugriff (z. B. Firmen-Firewall) gibt es ein **idempotentes SQL-Skript**: [`database/migrate.sql`](database/migrate.sql). Es kann im Supabase-SQL-Editor ausgeführt werden und überspringt bereits angewendete Migrationen.

Migration `V3UserScopedData` (Upgrade von v2):

- Favoriten: `Username` -> `UserId` als echter Fremdschlüssel. Bestehende Favoriten werden per SQL übernommen, verwaiste und doppelte Einträge entfernt.
- Übungen: `TrackingType` und `UserId` (eigene Übungen), Identity-Sequenz startet bei 1000 (IDs darunter sind für den Standardkatalog reserviert).
- Einheiten: `ClientId` (Idempotenz), `DurationSeconds`, Indizes auf `(UserId, Date)` und `(UserId, ClientId)`.
- `WorkoutSets -> Exercises` von `CASCADE` auf `NO ACTION`: eine verwendete Übung kann nicht mehr gelöscht werden und reißt keine Historie mit.

Neue Migration anlegen:

```bash
cd SprintLog.Api
dotnet tool restore
dotnet ef migrations add <Name>
dotnet ef migrations script --idempotent -o ../database/migrate.sql
```

## Betrieb und Automatisierung

| Was | Wie | Wo |
| --- | --- | --- |
| Migrationen | Werden beim Start automatisch angewendet (`appsettings.Production.json`: `Database:MigrateOnStartup = true`). Schlägt eine Migration fehl, startet die neue Version nicht und Render behält die alte. | Render-Deploy |
| Keep-alive | Aufruf von `/health` alle 10 min zwischen 5 und 22 Uhr UTC: hält Render Free tagsüber wach (kein Kaltstart von ~1 min) und verhindert, dass Supabase das Free-Projekt pausiert. Nachts nicht, damit die 750 Free-Stunden des Render-Workspaces auch für andere Services reichen. | [`keepalive.yml`](.github/workflows/keepalive.yml) |
| Backup | Nächtlicher `pg_dump` (PostgreSQL 17), mit AES-256 verschlüsselt, 30 Tage als Artefakt aufbewahrt. | [`backup.yml`](.github/workflows/backup.yml) |
| Health-Check | `GET /health` prüft API und Datenbank. In Render als *Health Check Path* eintragen. | Render-Settings |
| Fehler-Monitoring | Sentry für Server- und Browser-Fehler, sobald `SENTRY_DSN` gesetzt ist (siehe *Logs und Fehler-Monitoring*). | Render-Environment |

Einmalige Einrichtung für das Backup (GitHub -> Settings -> Secrets and variables -> Actions):

- `DB_CONNECTION_STRING`: derselbe Wert wie `ConnectionStrings__DefaultConnection` in Render
- `BACKUP_PASSPHRASE`: langes Passwort, z. B. aus dem Passwortmanager (ohne Passphrase ist das Backup nicht lesbar)

Jedes Backup wird direkt nach dem Erstellen entschlüsselt, in eine leere PostgreSQL 17 zurückgespielt und die Zeilenzahl jeder Tabelle mit der Quelle verglichen (Schritt *Restore test*).

Backup wiederherstellen:

```bash
gpg --decrypt sprintlog-2026-10-29.dump.gpg > sprintlog.dump
pg_restore --clean --if-exists --no-owner -d "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" sprintlog.dump
```

> Hinweis: GitHub deaktiviert geplante Workflows in öffentlichen Repos nach 60 Tagen ohne Repository-Aktivität. Dann unter *Actions* wieder aktivieren.

## API

Alle Endpunkte außer Registrierung, Login und Health erfordern `Authorization: Bearer <token>`. Fehler werden als [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807) zurückgegeben. Beispiel-Requests: [`SprintLog.Api/SprintLog.Api.http`](SprintLog.Api/SprintLog.Api.http).

| Methode | Pfad | Beschreibung |
| --- | --- | --- |
| POST | `/api/auth/register` | Konto anlegen; Browser: Cookie-Sitzung, sonst Bearer-Token; liefert 10 Wiederherstellungscodes |
| POST | `/api/auth/login` | Login (Browser: Cookies, API-Client: Token) |
| POST | `/api/auth/refresh` | Sitzung erneuern (Refresh-Cookie wird rotiert) bzw. neuen Bearer-Token ausstellen |
| POST | `/api/auth/logout` \| `logout-all` | Dieses Gerät / alle Geräte abmelden |
| GET | `/api/auth/me` | Profil, E-Mail-Status, verbleibende Wiederherstellungscodes |
| GET | `/api/auth/options` | Ist der E-Mail-Reset verfügbar? |
| POST | `/api/auth/password` | Passwort ändern (aktuelles Passwort nötig, andere Geräte werden abgemeldet) |
| POST | `/api/auth/recovery-codes` | Neue Wiederherstellungscodes (ersetzt alle alten) |
| POST | `/api/auth/recover` | Neues Passwort mit Wiederherstellungscode |
| PUT | `/api/auth/email` | E-Mail setzen (Bestätigungslink) oder entfernen |
| POST | `/api/auth/email/verify` | E-Mail bestätigen (Token aus dem Link) |
| POST | `/api/auth/forgot-password` \| `reset-password` | Reset-Link anfordern (Antwort immer gleich) / neues Passwort setzen |
| DELETE | `/api/auth/account` | Konto inkl. aller Daten löschen (Passwort im Body) |
| GET | `/api/exercises?category=` | Standardkatalog + eigene Übungen |
| POST | `/api/exercises` | Eigene Übung anlegen |
| DELETE | `/api/exercises/{id}` | Eigene Übung löschen (409, wenn in Verwendung) |
| GET/POST/DELETE | `/api/favorites[/{exerciseId}]` | Favoriten |
| POST | `/api/workouts` | Einheit speichern (idempotent über `clientId`); `workoutType: "Match"` = Spiel ohne Sätze mit `durationSeconds`, `sessionRpe` und `match` (Tore, Vorlagen, Gegner) |
| GET | `/api/workouts?limit=50&cursor=` | Historie seitenweise, neueste zuerst (Keyset-Pagination, `nextCursor`) |
| GET | `/api/workouts/changes?since=&cursor=` | Delta-Sync: Änderungen + gelöschte IDs seit `since`, ohne `since` alles |
| GET | `/api/workouts/history` | Alle Einheiten in einer Antwort (Kompatibilität mit älteren App-Versionen) |
| GET / PUT / DELETE | `/api/workouts/{id}` | Einzelne Einheit lesen / ersetzen / löschen |
| GET | `/api/programs` | Eigene Trainingspläne inkl. Tage und Vorgaben |
| GET | `/api/programs/templates` | Eingebaute Vorlagen |
| POST | `/api/programs/templates/{key}` | Plan aus Vorlage starten (wird aktiv) |
| POST / PUT / DELETE | `/api/programs[/{id}]` | Eigenen Plan anlegen / bearbeiten / löschen |
| POST | `/api/programs/{id}/activate` \| `deactivate` | Plan aktivieren (Woche 1 beginnt) / pausieren |
| GET | `/api/wellness?days=56` | Check-ins der letzten Tage (neueste zuerst) |
| PUT / DELETE | `/api/wellness/{yyyy-MM-dd}` | Check-in eines Tages anlegen/überschreiben bzw. löschen |
| GET | `/api/config` | Öffentliche Laufzeit-Konfiguration der Web-App (Sentry-DSN, Release) |
| GET | `/health` | Health-Check inkl. Datenbank |

## Projektstruktur

```
SprintLog/
├── SprintLog.Api/              .NET 8 Minimal API
│   ├── Endpoints/              Auth, Exercises, Favorites, Workouts, Programs
│   ├── DTOs/                   Request/Response-Records inkl. Validierung
│   ├── Models/ Data/           Entities, DbContext, Seed-Katalog
│   ├── Infrastructure/         JWT-Optionen, Validierung, Health-Check
│   ├── Services/               TokenService
│   ├── Migrations/             EF-Core-Migrationen
│   └── wwwroot/                Build-Ausgabe des Frontends (nicht eingecheckt)
├── tests/SprintLog.Api.Tests/  Integrationstests (xUnit, Testcontainers)
├── frontend/                   Vue-3-Frontend (Vite)
│   ├── src/lib/                Fachlogik ohne UI (Kennzahlen, Sync, Pläne, Figur) - unit-getestet
│   ├── src/stores/             Pinia-Stores (App-Zustand, UI)
│   ├── src/components/         Single-File Components
│   ├── src/sw.ts               Service Worker (Precache-Liste wird beim Build eingesetzt)
│   ├── tests/ e2e/ dev/        Vitest, Playwright, Mock-API
├── database/migrate.sql        Idempotentes SQL-Skript für Supabase
└── docker-compose.yml          API + PostgreSQL
```

## Herausforderungen und Lösungen

- **Firewall blockierte die DB-Verbindung.** Die Firmen-Firewall verhinderte den direkten Datenbankzugriff aus der IDE. Lösung: idempotentes SQL-Skript, das im Supabase-SQL-Editor ausgeführt werden kann, und eine lokale Docker-Datenbank für die Entwicklung.
- **JWT enthielt keine eindeutige Nutzer-ID.** Anfangs steckte nur der Benutzername im Token. Lösung: User-ID als Claim, Auslesen in allen Endpunkten, Favoriten zusätzlich per Migration von Username auf UserId umgestellt.
- **Offline gespeicherte Einheiten bekamen das falsche Datum.** Der Server setzte das Datum beim Synchronisieren. Lösung: Das Startdatum kommt vom Client, der Server prüft es auf Plausibilität.
- **Doppelte Einheiten bei instabiler Verbindung.** Kam die Antwort des Servers nicht an, wurde erneut gesendet. Lösung: Client-ID + Unique-Index, der Server antwortet idempotent.
- **App funktionierte offline nicht vollständig.** Tailwind und Chart.js kamen vom CDN und waren offline nicht verfügbar. Lösung: Alles wird mit Vite gebaut und selbst ausgeliefert; der Service Worker lädt die gebauten Dateien (mit Content-Hash) beim Installieren vor.
- **Keine strikte CSP möglich.** Vue kompilierte die Templates im Browser (`new Function`), das verlangt `unsafe-eval`. Lösung: Umstieg auf Vite + Single-File Components; die Templates werden beim Build kompiliert und die API sendet `script-src 'self'` ohne Ausnahmen. Die E2E-Tests laufen mit derselben Policy und schlagen bei jedem Verstoß fehl.
- **Übersetzungen ohne Laufzeit-Compiler.** Übliche i18n-Bibliotheken kompilieren Nachrichten zur Laufzeit, was mit der strikten CSP kollidiert. Lösung: eigenes, kleines i18n-Modul; die Schlüssel sind TypeScript-Typen aus den englischen Texten, sodass ein fehlender oder falsch geschriebener Schlüssel in DE/RU schon beim Build auffällt. Ein Test prüft zusätzlich, dass alle Sprachen dieselben Platzhalter haben und jede Übung und Vorlage des Servers übersetzt ist.
- **Feldübungen hatten keine Eingabefelder.** Für Distanz/Zeit gab es im Dialog keine Felder, außerdem waren Kraftübungen in der Kategorie "Football" (z. B. Trap Bar Deadlift) falsch als Zeitübung behandelt. Lösung: `TrackingType` pro Übung in der Datenbank.

## Ausblick

- Körpergewicht und Wellness-Daten (Schlaf, Müdigkeit) für eine Belastungssteuerung
- Teilen von Rekorden und Mannschafts-Ansicht für das Team

---

_Erstellt von [took1s](https://github.com/took1s)._
