// App-Icon auf dem Home-Bildschirm: Standard, Halloween oder automatisch nach Saison.
//
// - iOS-App: echtes Wechseln über das eigene Plugin "AppIcon" (ios/App/App/AppIconPlugin.swift).
//   iOS zeigt danach einmal kurz "Du hast das Symbol geändert" - das ist Systemverhalten.
// - Web/PWA: Ein installiertes Home-Bildschirm-Symbol kann eine Webseite nicht ändern. Wir tauschen Favicon und
//   apple-touch-icon - beim nächsten "Zum Home-Bildschirm" nimmt iOS das gewählte Symbol.
// Die Wahl gilt pro Gerät (localStorage), nicht pro Konto.

import { ref } from 'vue';
import { inSeason } from './theme';
import { isNative } from './native';

export type AppIconChoice = 'auto' | 'default' | 'halloween';
export type AppIconName = 'default' | 'halloween';
export const APP_ICON_CHOICES: readonly AppIconChoice[] = ['auto', 'default', 'halloween'];

const KEY = 'sprintlog:appIcon';
/** Name des alternativen Icon-Sets im Asset-Katalog. */
const NATIVE_NAME: Record<AppIconName, string> = { default: '', halloween: 'AppIcon-Halloween' };
const WEB_ICON: Record<AppIconName, { touch: string; favicon: string }> = {
  default: { touch: '/apple-touch-icon.png', favicon: '/favicon.svg' },
  halloween: { touch: '/brand/apple-touch-icon-halloween.png', favicon: '/brand/icon-halloween.svg' },
};

const read = (): AppIconChoice => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'default' || v === 'halloween' || v === 'auto' ? v : 'auto';
  } catch { return 'auto'; }
};

export const appIconChoice = ref<AppIconChoice>(read());
/** Kann das Gerät das Icon wirklich wechseln (nur iOS-App)? */
export const appIconNative = ref(false);
/** Zuletzt gesetztes Icon (für die Anzeige in den Einstellungen). */
export const appIconCurrent = ref<AppIconName>('default');

/** Welches Icon gilt für eine Wahl an einem Datum? */
export function resolveAppIcon(choice: AppIconChoice, date = new Date()): AppIconName {
  if (choice === 'auto') return inSeason('halloween', date) ? 'halloween' : 'default';
  return choice;
}

interface AppIconPlugin {
  getName(): Promise<{ name: string; supported: boolean }>;
  setName(o: { name: string }): Promise<{ changed: boolean }>;
}
let plugin: Promise<AppIconPlugin> | null = null;
const nativePlugin = () => (plugin ??= import('@capacitor/core').then((m) => m.registerPlugin<AppIconPlugin>('AppIcon')));

function applyWeb(icon: AppIconName) {
  const set = (sel: string, href: string) => { const el = document.querySelector<HTMLLinkElement>(sel); if (el && el.getAttribute('href') !== href) el.setAttribute('href', href); };
  set('link[rel="apple-touch-icon"]', WEB_ICON[icon].touch);
  set('link[rel="icon"][type="image/svg+xml"]', WEB_ICON[icon].favicon);
}

/** Icon anwenden. Gibt zurück, ob es sich auf dem Gerät geändert hat. */
export async function applyAppIcon(date = new Date()): Promise<boolean> {
  const icon = resolveAppIcon(appIconChoice.value, date);
  appIconCurrent.value = icon;
  if (!isNative()) { applyWeb(icon); return false; }
  try {
    const p = await nativePlugin();
    const { supported } = await p.getName();
    appIconNative.value = supported;
    if (!supported) return false;
    return (await p.setName({ name: NATIVE_NAME[icon] })).changed;
  } catch (e) {
    // Ältere App-Version ohne Plugin oder iOS lehnt ab: kein Fehler für den Nutzer, Web-Fallback reicht
    console.warn('[appIcon]', e);
    return false;
  }
}

export async function setAppIcon(choice: AppIconChoice): Promise<boolean> {
  appIconChoice.value = choice;
  try { localStorage.setItem(KEY, choice); } catch { /* privater Modus: gilt nur bis zum Neuladen */ }
  return applyAppIcon();
}

/** Beim Start: Saison prüfen (z. B. ab 16.11. wieder Standard bei "Automatisch"). */
export function initAppIcon(): void {
  void applyAppIcon();
}
