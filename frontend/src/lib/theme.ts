// Erscheinungsbild: Theme (Charakter) + Farbschema (hell/dunkel/automatisch).
//
// Wird VOR dem Mount der App angewendet (main.ts), damit es kein Aufflackern im falschen Theme gibt.
// Gespeichert geräteweit (nicht pro Konto) - der Login-Bildschirm soll schon richtig aussehen.

import { ref, watch } from 'vue';
import { readJson, writeJson } from './storage';

export const THEMES = ['pitch', 'clean', 'midnight', 'mono'] as const;
export type ThemeName = (typeof THEMES)[number];
export const SCHEMES = ['auto', 'light', 'dark'] as const;
export type SchemePreference = (typeof SCHEMES)[number];

export interface Appearance { theme: ThemeName; scheme: SchemePreference }

export const APPEARANCE_KEY = 'sprintlog:appearance';
export const DEFAULT_APPEARANCE: Appearance = Object.freeze({ theme: 'pitch', scheme: 'auto' });

/** Vorschaufarben für die Auswahl in den Einstellungen (gleich wie in themes.css: Hintergrund, Karte, Akzent). */
export const THEME_SWATCHES: Record<ThemeName, Record<'light' | 'dark', [string, string, string]>> = {
  pitch: { dark: ['#0e1311', '#161d1a', '#c6ff3d'], light: ['#f1f4ed', '#ffffff', '#c6ff3d'] },
  clean: { dark: ['#11110f', '#1c1b18', '#ff6a33'], light: ['#f6f5f2', '#ffffff', '#e84810'] },
  midnight: { dark: ['#090b14', '#131727', '#7c8cff'], light: ['#f3f4fb', '#ffffff', '#4f46e5'] },
  mono: { dark: ['#080808', '#121212', '#ff3328'], light: ['#f2f2f0', '#ffffff', '#d60600'] },
};

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

export const appearance = ref<Appearance>(sanitizeAppearance(readJson<Partial<Appearance>>(APPEARANCE_KEY)));
/** Aufgelöstes Schema (für Komponenten, z. B. Diagrammfarben neu zeichnen). */
export const activeScheme = ref<'light' | 'dark'>(resolveScheme(appearance.value.scheme));

export function applyAppearance(next: Appearance = appearance.value, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  const scheme = resolveScheme(next.scheme);
  activeScheme.value = scheme;
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
  watch(appearance, (value) => { writeJson(APPEARANCE_KEY, value); applyAppearance(value); }, { deep: true });
}

export function setTheme(theme: ThemeName): void { appearance.value = { ...appearance.value, theme }; }
export function setScheme(scheme: SchemePreference): void { appearance.value = { ...appearance.value, scheme }; }

/** Aktueller Wert eines Farb-Tokens als CSS-Farbe (für Canvas-Diagramme, die keine CSS-Variablen kennen). */
export function tokenColor(name: string, alpha = 1, root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): string {
  const raw = root ? getComputedStyle(root).getPropertyValue(`--c-${name}`).trim() : '';
  const rgb = raw || '128 128 128';
  return alpha >= 1 ? `rgb(${rgb})` : `rgb(${rgb} / ${alpha})`;
}
