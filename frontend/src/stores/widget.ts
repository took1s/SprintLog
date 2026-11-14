// Widget-Daten aktuell halten (nur iPhone-App): bei jeder Änderung an Routinen, Zusatz-Einheiten, Plan, Sprache oder
// Theme - und beim Wechsel in den Hintergrund - neuen Schnappschuss an das native Plugin "WidgetBridge" geben.
import { watch } from 'vue';
import { locale, t } from '../i18n';
import { isNative } from '../lib/native';
import { clockTime } from '../lib/routines';
import { activeScheme, appearance } from '../lib/theme';
import { widgetSnapshot } from '../lib/widget';
import { useAppStore } from './app';
import { usePlannedStore } from './planned';
import { useRoutinesStore } from './routines';

interface WidgetBridgePlugin { update(options: { json: string }): Promise<void>; clear(): Promise<void> }
let plugin: Promise<WidgetBridgePlugin> | null = null;
const bridge = () => (plugin ??= import('@capacitor/core').then((m) => m.registerPlugin<WidgetBridgePlugin>('WidgetBridge')));

let started = false;
let timer: number | null = null;

function colors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return { bg: v('--c-surface', '22 29 26'), fg: v('--c-fg', '242 245 240'), muted: v('--c-subtle', '134 146 139'), accent: v('--c-accent', '198 255 61'), success: v('--c-success', '52 211 153') };
}

async function push() {
  const app = useAppStore();
  const routines = useRoutinesStore();
  const snapshot = widgetSnapshot({
    today: routines.today,
    now: clockTime(new Date()),
    routines: routines.routines,
    planned: usePlannedStore().items,
    schedule: app.activeProgram ?? null,
    planDayName: app.programInfo?.next?.name ?? null,
    colors: colors(),
    labels: {
      routines: t('routines.title'), allDone: t('routines.allDone'), none: t('widget.none'), next: t('widget.next'),
      training: t('week.training'), match: t('week.match'), rest: t('week.rest'), extra: t('planned.title'),
    },
  });
  try { await (await bridge()).update({ json: JSON.stringify(snapshot) }); } catch { /* ältere App ohne Widget */ }
}

function schedule(delay = 800) {
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => { timer = null; void push(); }, delay);
}

/** Einmal nach der Anmeldung (nur nativ). */
export function startWidgetSync() {
  if (!isNative()) return;
  schedule(0);
  if (started) return;
  started = true;
  const app = useAppStore();
  const routines = useRoutinesStore();
  const planned = usePlannedStore();
  watch(() => [routines.routines, planned.items, app.activeProgram?.trainingDays, app.activeProgram?.matchDays, app.programInfo?.next?.name,
    locale.value, appearance.value.theme, activeScheme.value, routines.today], () => schedule());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void push(); });
}

/** Abmelden: Widget leeren (zeigt sonst Namen der Routinen). */
export async function clearWidget() {
  if (!isNative()) return;
  if (timer != null) window.clearTimeout(timer);
  timer = null;
  try { await (await bridge()).clear(); } catch { /* ignore */ }
}
