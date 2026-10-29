// Mehrsprachigkeit (EN / DE / RU) ohne Laufzeit-Compiler - CSP-konform (kein eval) und typsicher:
// Schlüssel sind Pfade in den englischen Texten, DE/RU müssen dieselbe Struktur haben (prüft TypeScript).

import { ref, watch } from 'vue';
import { en } from './en';
import { de } from './de';
import { ru } from './ru';

export const SUPPORTED_LOCALES = ['en', 'de', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', de: 'Deutsch', ru: 'Русский' };

/** Pluralformen nach Intl.PluralRules (Russisch braucht one/few/many). */
export type Plural = { one: string; few?: string; many?: string; other: string };
type Leaf = string | Plural;
type Tree = { [key: string]: Leaf | Tree };

/** Dieselbe Struktur wie die englischen Texte, aber mit beliebigem Text (für DE/RU). */
export type Messages<T = typeof en> = { [K in keyof T]: T[K] extends string ? string : T[K] extends Plural ? Plural : Messages<T[K]> };

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = { [K in keyof T & string]: T[K] extends string | Plural ? K : Join<K, Paths<T[K]>> }[keyof T & string];
type PluralPaths<T> = { [K in keyof T & string]: T[K] extends Plural ? K : T[K] extends string ? never : Join<K, PluralPaths<T[K]>> }[keyof T & string];

export type MessageKey = Paths<typeof en>;
export type PluralKey = PluralPaths<typeof en>;
export type Params = Record<string, string | number>;

const catalogs: Record<Locale, Tree> = { en: en as unknown as Tree, de: de as unknown as Tree, ru: ru as unknown as Tree };

const LOCALE_KEY = 'sprintlog:locale';

export function detectLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Locale {
  for (const lang of languages) {
    const base = lang?.slice(0, 2).toLowerCase();
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return 'en';
}

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  } catch { /* ignore */ }
  return detectLocale();
}

/** Aktuelle Sprache (reaktiv - Templates und computed werden bei Wechsel neu berechnet). */
export const locale = ref<Locale>(initialLocale());

export function setLocale(next: Locale): void {
  locale.value = next;
}

watch(locale, (value) => {
  try { localStorage.setItem(LOCALE_KEY, value); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.lang = value;
}, { immediate: true });

function lookup(lang: Locale, key: string): Leaf | undefined {
  let node: unknown = catalogs[lang];
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node as Leaf | undefined;
}

const interpolate = (text: string, params?: Params) =>
  params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;

const pluralRules = new Map<Locale, Intl.PluralRules>();
function pluralForm(lang: Locale, count: number): keyof Plural {
  let rules = pluralRules.get(lang);
  if (!rules) { rules = new Intl.PluralRules(lang); pluralRules.set(lang, rules); }
  return rules.select(count) as keyof Plural;
}

function resolve(key: string, count?: number): string {
  for (const lang of [locale.value, 'en'] as Locale[]) {
    const leaf = lookup(lang, key);
    if (typeof leaf === 'string') return leaf;
    if (leaf && typeof leaf === 'object') {
      const form = count === undefined ? 'other' : pluralForm(lang, count);
      return leaf[form] ?? leaf.other;
    }
  }
  if (import.meta.env?.DEV) console.warn(`[i18n] missing key "${key}"`);
  return key;
}

/** Text zum Schlüssel, z. B. t('auth.login') oder t('history.sets', { n: 3 }). */
export function t(key: MessageKey, params?: Params): string {
  return interpolate(resolve(key), params);
}

/** Text mit Pluralform; {n} wird durch count ersetzt. Beispiel: tn('units.workouts', 5) -> "5 тренировок". */
export function tn(key: PluralKey, count: number, params?: Params): string {
  return interpolate(resolve(key, count), { n: count, ...params });
}

/** Für dynamische Schlüssel (z. B. aus Daten), die nicht statisch geprüft werden können. Fällt auf `fallback` zurück. */
export function tDynamic(key: string, fallback: string, params?: Params): string {
  for (const lang of [locale.value, 'en'] as Locale[]) {
    const leaf = lookup(lang, key);
    if (typeof leaf === 'string') return interpolate(leaf, params);
  }
  return interpolate(fallback, params);
}

/** Text einer bestimmten Sprache (z. B. Englisch als Vergleich mit Daten vom Server) oder undefined. */
export function textIn(lang: Locale, key: string): string | undefined {
  const leaf = lookup(lang, key);
  return typeof leaf === 'string' ? leaf : undefined;
}

/** BCP-47-Tag für Intl (Zahlen, Datum). */
export const intlLocale = (): string => ({ en: 'en-GB', de: 'de-DE', ru: 'ru-RU' } as const)[locale.value];
