# SprintLog - Projektwissen für Claude

PWA zum Loggen von Gym- und Feldtraining (Fußball). Offline-first, ein Nutzer = ein Athlet.

## Stack
- Backend: .NET 8 Minimal API (`SprintLog.Api`), EF Core 8 + PostgreSQL (Npgsql), Migrationen laufen beim Start.
- Frontend: Vite + Vue 3 SFC + strict TypeScript + Pinia + Tailwind (`frontend/`), Build nach `SprintLog.Api/wwwroot`.
- Hosting: Render Free (Docker), Sentry (EU), Brevo für E-Mails.

## Befehle (im Repo-Root)
- `npm run typecheck` · `npm test` (Vitest) · `npm run build`
- `npm run test:e2e` (Playwright gegen `frontend/dev/mock-api.mjs`; lokal `CHROMIUM_PATH=/opt/pw-browsers/chromium-*/chrome-linux*/chrome`)
- `npm run mock:demo` startet das Mock-Backend mit Demodaten (Screenshots).
- iOS-App (Capacitor, `ios/`): `npm run build:native` (nach `frontend/native-dist`), `npm run ios:sync`; Build + TestFlight nur in CI (`.github/workflows/ios.yml`, macOS).
- Backend baut/testet nur in CI (NuGet lokal blockiert). Migration erzeugen: Commit-Message mit `[gen-migration:Name]`.

## Konventionen
- Code-Kommentare auf Deutsch, UI-Texte über `frontend/src/i18n/{en,de,ru}.ts` (typsichere Keys, Pluralformen).
- Strikte CSP: kein Inline-Script/-Style aus Strings, keine Drittanbieter-Hosts im Browser.
- Farben/Schriften NUR über Design-Tokens (`frontend/src/styles/themes.css`), nie Hex-Werte in Komponenten.
- Offline-first: Änderungen zuerst lokal (Queue), dann Sync; Server erkennt `clientId` wieder (idempotent).
- Feature-Branches + PR; kein Force-Push; `main` merged der Nutzer.

## Agenten
`.claude/agents/`: `designer` (UI/UX, Themes, Reviews), `creative-director` (Ideen, Konzepte, Texte), `agent-architect` (neue Agenten entwerfen).
