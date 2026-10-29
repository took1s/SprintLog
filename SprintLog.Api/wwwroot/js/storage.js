// Sicherer Zugriff auf localStorage (kann im privaten Modus / bei vollem Speicher werfen).

const PREFIX = 'sprintlog';

export function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[storage] write failed', key, e);
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** Globale Schlüssel (geräteweit). */
export const Keys = Object.freeze({
  token: 'sprintlog_jwt',          // bewusst wie in v2, damit Nutzer eingeloggt bleiben
  user: `${PREFIX}:user`,
  settings: `${PREFIX}:settings`,
  legacySets: 'sprintlog_sets',    // v2: laufende Einheit
  legacyQueue: 'sync_queue',       // v2: Offline-Warteschlange
});

/** Nutzerspezifische Schlüssel - verhindert, dass Daten von Konto A bei Konto B landen. */
export const userKeys = (userId) => ({
  exercises: `${PREFIX}:${userId}:exercises`,
  history: `${PREFIX}:${userId}:history`,
  favorites: `${PREFIX}:${userId}:favorites`,
  queue: `${PREFIX}:${userId}:queue`,
  session: `${PREFIX}:${userId}:session`,
  timer: `${PREFIX}:${userId}:timer`,
  programs: `${PREFIX}:${userId}:programs`,
  templates: `${PREFIX}:${userId}:templates`,
});

/** Liest Nutzer-ID und Name aus einem JWT (nur Anzeige/Zuordnung - geprüft wird der Token auf dem Server). */
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(payload))));
    const id = json.nameid ?? json['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
    const name = json.unique_name ?? json['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
    return { userId: id ? Number(id) : null, username: name ?? null, exp: json.exp ? json.exp * 1000 : null };
  } catch {
    return { userId: null, username: null, exp: null };
  }
}

export function newClientId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Fallback für ältere Browser (RFC 4122 v4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
