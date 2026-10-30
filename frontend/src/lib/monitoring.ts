// Fehler-Monitoring im Browser (Sentry) - nur wenn der Server einen DSN liefert (GET /api/config).
// - Das Sentry-SDK wird erst dann nachgeladen (eigener Chunk) -> ohne DSN kein zusätzliches JavaScript.
// - Alle Meldungen laufen über /api/monitoring/tunnel: CSP bleibt bei connect-src 'self', Werbeblocker stören nicht.
// - Keine personenbezogenen Daten: nur die Nutzer-ID, URLs ohne Query (Reset-/Bestätigungs-Tokens!), keine Cookies.

import { watch, type App } from 'vue';
import { clientHeaders } from './api';
import { apiUrl } from './native';

export interface ClientConfig { sentryDsn: string | null; environment: string; release: string }

const CONFIG_KEY = 'sprintlog:client-config';
export const TUNNEL = '/api/monitoring/tunnel';

/** Laufzeit-Konfiguration vom Server; offline die zuletzt bekannte. */
export async function loadClientConfig(fetcher: typeof fetch = fetch): Promise<ClientConfig | null> {
  try {
    const response = await fetcher(apiUrl('/api/config'), { headers: { Accept: 'application/json', ...clientHeaders() } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = (await response.json()) as ClientConfig;
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* ignore */ }
    return config;
  } catch {
    try {
      const cached = localStorage.getItem(CONFIG_KEY);
      return cached ? (JSON.parse(cached) as ClientConfig) : null;
    } catch {
      return null;
    }
  }
}

/** URL ohne Query und Fragment - dort stehen bei SprintLog Einmal-Tokens (?reset=..., ?confirm=...). */
export function scrubUrl(url: string): string {
  const cut = url.search(/[?#]/);
  return cut < 0 ? url : url.slice(0, cut);
}

type Crumb = { data?: Record<string, unknown> };
type ScrubbableEvent = {
  request?: { url?: string; cookies?: unknown; headers?: Record<string, string>; query_string?: unknown };
  breadcrumbs?: Crumb[];
};

/** Letzte Kontrolle vor dem Versand. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) if (/cookie|authorization|token/i.test(key)) delete event.request.headers[key];
    }
  }
  for (const crumb of event.breadcrumbs ?? []) {
    for (const field of ['url', 'to', 'from'] as const) {
      const value = crumb.data?.[field];
      if (typeof value === 'string') crumb.data![field] = scrubUrl(value);
    }
  }
  return event;
}

/** Startet Sentry, falls konfiguriert. `userId` liefert die aktuelle Nutzer-ID (reaktiv). Gibt zurück, ob Sentry aktiv ist. */
export async function initMonitoring(app: App, userId: () => number | null | undefined): Promise<boolean> {
  const config = await loadClientConfig();
  if (!config?.sentryDsn) return false;

  const Sentry = await import('./sentry-client');
  Sentry.init({
    app,
    dsn: config.sentryDsn,
    tunnel: apiUrl(TUNNEL),
    release: config.release,
    environment: config.environment,
    // Nur Fehler: keine Sessions, kein Tracing, kein Replay (Datenschutz + Free-Kontingent).
    integrations: (defaults) => defaults.filter((i) => i.name !== 'BrowserSession'),
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubEvent({ breadcrumbs: [crumb] }).breadcrumbs![0] as typeof crumb,
    // Typische Rauschquellen ohne Aussagekraft
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications', 'AbortError'],
  });
  watch(userId, (id) => Sentry.setUser(id ? { id: String(id) } : null), { immediate: true });
  return true;
}
