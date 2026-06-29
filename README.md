# SprintLog

**Next-Gen Hybrid Fitness Tracker** — eine offline-fähige Progressive Web App (PWA), die Krafttraining und Feld-Sportarten in einer einzigen Anwendung vereint.

🔗 **Live-Demo:** https://sprintlog-api.onrender.com/

> Mini-Projekt im 1. Ausbildungsjahr — Fachinformatiker/in für Anwendungsentwicklung.

---

## Inhalt

- [Über das Projekt](#über-das-projekt)
- [Features](#features)
- [Screenshots](#screenshots)
- [Tech-Stack](#tech-stack)
- [Architektur](#architektur)
- [Lokal starten (Docker)](#lokal-starten-docker)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Herausforderungen](#herausforderungen--lösungen)
- [Ausblick](#ausblick)

---

## Über das Projekt

Hybrid-Athleten trainieren sowohl im Kraftraum als auch auf dem Sportplatz — die meisten Fitness-Apps decken aber nur einen dieser Bereiche ab, funktionieren offline nicht und trennen die Daten in getrennte Silos. **SprintLog** schließt diese Lücke: Kraft- und Feldtraining werden in einer schlanken, offline-first aufgebauten PWA zusammengeführt.

## Features

- **Gym-Tracking** — Sätze, Wiederholungen, Volumen und geschätztes 1-Rep-Max (Epley-Formel).
- **Feld-Tracking** — Sprints, Sprünge, Distanz, Zeit und Höchstgeschwindigkeit.
- **Offline-First** — alle Aktionen werden lokal gepuffert und bei Verbindung automatisch synchronisiert.
- **Intelligente Telemetrie** — dynamische Intensitätszonen (Kraft / Hypertrophie / Ausdauer) und Pausentimer mit haptischem Feedback.
- **Automatische Rekorde** — Auszeichnungen für `MAX WT`, `MAX VOL`, `MAX DIST` und `TOP SPD`.
- **Installierbar** — als PWA auf dem Smartphone installierbar.

## Screenshots

<!-- Screenshots hier einfügen, sobald vorhanden -->
| Dashboard | Analyse |
| --- | --- |
| _Screenshot folgt_ | _Screenshot folgt_ |

## Tech-Stack

| Bereich     | Technologie |
| ----------- | ----------- |
| Backend     | C# / .NET 8 Web API |
| Datenbank   | PostgreSQL (gehostet über Supabase) |
| Auth        | JWT (JSON Web Tokens) |
| Frontend    | Vue 3, Tailwind CSS, Chart.js |
| Deployment  | Docker · docker-compose · Render |

## Architektur

Das Frontend (Vue 3) puffert Aktionen offline im `localStorage` und stellt sie in eine Sync-Queue. Sobald eine Verbindung besteht, werden die gepufferten Anfragen an die **.NET-8-Web-API** gesendet, die sie nach JWT-Prüfung in der **PostgreSQL-Datenbank** persistiert.

```
[ Vue 3 PWA ] --(offline queue / localStorage)--> [ .NET 8 API ] --(JWT)--> [ PostgreSQL ]
```

## Lokal starten (Docker)

Voraussetzung: [Docker](https://www.docker.com/) und Docker Compose.

```bash
# Repository klonen
git clone https://github.com/took1s/SprintLog.git
cd SprintLog

# .env anlegen (siehe Abschnitt unten) und Container starten
docker-compose up --build
```

Die API ist anschließend unter `http://localhost:8080` erreichbar (Port ggf. an `docker-compose.yml` anpassen).

## Umgebungsvariablen

Die folgenden Werte werden zur Laufzeit als Umgebungsvariablen erwartet — **nicht** in `appsettings.json` einchecken:

```env
ConnectionStrings__DefaultConnection=Host=...;Database=...;Username=...;Password=...
Jwt__Key=<dein-geheimer-signierschlüssel>
Jwt__Issuer=SprintLog
Jwt__Audience=SprintLog
```

> In der Cloud (Render) werden diese Werte im Dashboard unter *Environment* hinterlegt.

## Herausforderungen & Lösungen

- **Firewall blockierte die DB-Verbindung.** Die Firmen-Firewall verhinderte den direkten Datenbankzugriff aus der IDE. Schema und Migrationen wurden daraufhin manuell über den Supabase-SQL-Editor ausgeführt.
- **JWT-Validierung schlug nach dem Deploy fehl (401).** Das Signing-Secret lag lokal in `appsettings`, war in der Cloud aber nicht vorhanden. Lösung: das Secret als Umgebungsvariable in Render auslagern.

## Ausblick

- Robustere Konfliktauflösung bei der Offline-Synchronisation
- Erweiterte Analysen und Diagramme (Chart.js)
- Social-Features (Profile, Bestenlisten, Teilen)
- KI-gestützte Trainingsempfehlungen auf Basis der Telemetrie

---

_Erstellt von [took1s](https://github.com/took1s)._
