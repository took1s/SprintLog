// Erscheinungsbild: Theme (Charakter) + Farbschema (hell/dunkel/automatisch).
//
// Wird VOR dem Mount der App angewendet (main.ts), damit es kein Aufflackern im falschen Theme gibt.
// Gespeichert geräteweit (nicht pro Konto) - der Login-Bildschirm soll schon richtig aussehen.

import { ref, watch } from 'vue';
import { Keys, readJson, writeJson } from './storage';
import { syncStatusBar } from './native';

export const THEMES = ['matchday', 'pitch', 'clean', 'midnight', 'mono', 'striker', 'halloween'] as const;
export type ThemeName = (typeof THEMES)[number];
export const SCHEMES = ['auto', 'light', 'dark'] as const;
export type SchemePreference = (typeof SCHEMES)[number];

export interface Appearance { theme: ThemeName; scheme: SchemePreference }

export const APPEARANCE_KEY = 'sprintlog:appearance';
export const DEFAULT_APPEARANCE: Appearance = Object.freeze({ theme: 'matchday', scheme: 'auto' });
/** Version der gespeicherten Auswahl: 2 = Matchday ist Standard (vorher Pitch Night). */
export const APPEARANCE_VERSION = 2;
/** Vorheriges Standard-Theme - in den Einstellungen und über die Hinweis-Meldung zurückholbar. */
export const PREVIOUS_DEFAULT_THEME: ThemeName = 'pitch';

/** Vorschaufarben für die Auswahl in den Einstellungen (gleich wie in themes.css: Hintergrund, Karte, Akzent). */
export const THEME_SWATCHES: Record<ThemeName, Record<'light' | 'dark', [string, string, string]>> = {
  matchday: { dark: ['#0b0c0c', '#181919', '#c8f248'], light: ['#f2f2ee', '#ffffff', '#c8f248'] },
  pitch: { dark: ['#0e1311', '#161d1a', '#c6ff3d'], light: ['#f1f4ed', '#ffffff', '#c6ff3d'] },
  clean: { dark: ['#11110f', '#1c1b18', '#ff6a33'], light: ['#f6f5f2', '#ffffff', '#e84810'] },
  midnight: { dark: ['#090b14', '#131727', '#7c8cff'], light: ['#f3f4fb', '#ffffff', '#4f46e5'] },
  mono: { dark: ['#080808', '#121212', '#ff3328'], light: ['#f2f2f0', '#ffffff', '#d60600'] },
  striker: { dark: ['#060a18', '#0c1328', '#2e8cff'], light: ['#f0f5fc', '#ffffff', '#146ef5'] },
  halloween: { dark: ['#120c1c', '#1c142a', '#ff7a1a'], light: ['#f8f4ef', '#ffffff', '#ff7a1a'] },
};

/** Saison-Themes: in diesem Zeitraum in der Auswahl als "Saison" markiert (Monat 1-12, Tag). */
export const SEASONAL: Partial<Record<ThemeName, { from: [number, number]; to: [number, number] }>> = {
  halloween: { from: [10, 1], to: [11, 15] },
};

/** Ist das Theme gerade in seiner Saison? */
export function inSeason(theme: ThemeName, date = new Date()): boolean {
  const s = SEASONAL[theme];
  if (!s) return false;
  const v = (date.getMonth() + 1) * 100 + date.getDate();
  return v >= s.from[0] * 100 + s.from[1] && v <= s.to[0] * 100 + s.to[1];
}

export function sanitizeAppearance(value: Partial<Appearance> | null | undefined): Appearance {
  return {
    theme: THEMES.includes(value?.theme as ThemeName) ? (value!.theme as ThemeName) : DEFAULT_APPEARANCE.theme,
    scheme: SCHEMES.includes(value?.scheme as SchemePreference) ? (value!.scheme as SchemePreference) : DEFAULT_APPEARANCE.scheme,
  };
}

const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

/** "auto" -> tatsächliches Schema des Systems. */
export function resolveScheme(preference: SchemePreference, systemDark = media?.matches ?? true): 'light' | 'dark' {
  return preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference;
}

type StoredAppearance = Partial<Appearance> & { v?: number };

/**
 * Einmalige Umstellung auf das neue Standard-Theme: Wer Pitch Night hatte (gespeichert aus der Zeit, als es Standard war)
 * oder nie etwas gewählt hat, bekommt Matchday. Wer bewusst ein anderes Theme gewählt hat, behält es.
 * `migrated` meldet, dass umgestellt wurde (die App bietet dann einmal "Zurück zum alten Look" an).
 */
export function migrateAppearance(stored: StoredAppearance | null): { value: Appearance; migrated: boolean } {
  const value = sanitizeAppearance(stored);
  if ((stored?.v ?? 1) >= APPEARANCE_VERSION) return { value, migrated: false };
  const wasDefault = !stored?.theme || stored.theme === PREVIOUS_DEFAULT_THEME;
  return wasDefault ? { value: { ...value, theme: DEFAULT_APPEARANCE.theme }, migrated: true } : { value, migrated: false };
}

const stored = readJson<StoredAppearance>(APPEARANCE_KEY);
const initial = migrateAppearance(stored);
export const appearance = ref<Appearance>(initial.value);
/**
 * Auf diesem Gerät gerade umgestellt und schon einmal angemeldet gewesen (also kein neuer Nutzer):
 * Die App zeigt einmal eine Meldung mit "Alter Look" (App.vue).
 */
export const themeMigrated = ref(initial.migrated && readJson(Keys.user) != null);
if ((stored?.v ?? 1) < APPEARANCE_VERSION) writeJson(APPEARANCE_KEY, { ...initial.value, v: APPEARANCE_VERSION });
/** Aufgelöstes Schema (für Komponenten, z. B. Diagrammfarben neu zeichnen). */
export const activeScheme = ref<'light' | 'dark'>(resolveScheme(appearance.value.scheme));

export function applyAppearance(next: Appearance = appearance.value, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  const scheme = resolveScheme(next.scheme);
  activeScheme.value = scheme;
  void syncStatusBar(scheme);
  if (!root) return;
  root.dataset.theme = next.theme;
  root.dataset.scheme = scheme;
  root.classList.toggle('dark', scheme === 'dark');
  // Statusleiste/Browser-Rahmen in der Hintergrundfarbe des Themes
  const meta = root.ownerDocument.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_SWATCHES[next.theme][scheme][0]);
}

let started = false;
/** Einmalig beim Start: anwenden, auf Systemwechsel reagieren, Änderungen speichern. */
export function initAppearance(): void {
  applyAppearance();
  if (started) return;
  started = true;
  media?.addEventListener?.('change', () => { if (appearance.value.scheme === 'auto') applyAppearance(); });
  watch(appearance, (value) => { writeJson(APPEARANCE_KEY, { ...value, v: APPEARANCE_VERSION }); applyAppearance(value); }, { deep: true });
}

export function setTheme(theme: ThemeName): void { appearance.value = { ...appearance.value, theme }; }
export function setScheme(scheme: SchemePreference): void { appearance.value = { ...appearance.value, scheme }; }

/** Aktueller Wert eines Farb-Tokens als CSS-Farbe (für Canvas-Diagramme, die keine CSS-Variablen kennen). */
export function tokenColor(name: string, alpha = 1, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): string {
  const raw = root ? getComputedStyle(root).getPropertyValue(`--c-${name}`).trim() : '';
  const rgb = raw || '128 128 128';
  return alpha >= 1 ? `rgb(${rgb})` : `rgb(${rgb} / ${alpha})`;
}
