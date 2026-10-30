// Brücke zur nativen iOS-App (Capacitor).
//
// Die Web-App bleibt dieselbe - in der App läuft sie aus dem App-Paket (Origin capacitor://localhost):
// - Die API liegt auf einem anderen Host -> absolute URLs, Bearer-Token statt Cookies (Cookies wären Drittanbieter-Cookies).
// - Access- und Refresh-Token liegen in @capacitor/preferences (UserDefaults der App, nicht im Web-Speicher,
//   den iOS bei Speichermangel leeren darf).
// - Native Extras: Haptik, Mitteilung am Ende der Satzpause (auch bei gesperrtem Bildschirm), Display wach halten.
//
// Alle Plugins werden dynamisch geladen: Im Browser kommt davon nichts in den Start-Chunk.

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

/** Läuft die App nativ (iOS/Android)? Capacitor injiziert window.Capacitor schon vor dem ersten Skript. */
export function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function nativePlatform(): 'ios' | 'android' {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.getPlatform?.() === 'android' ? 'android' : 'ios';
}

/** Basis-URL der API in der App (Build-Variable, im Web leer = gleicher Origin). */
export const NATIVE_API_BASE: string = typeof __NATIVE_API__ === 'string' ? __NATIVE_API__ : '';

/** Absolute URL in der App, relative im Browser. */
export function apiUrl(path: string): string {
  return isNative() && NATIVE_API_BASE && path.startsWith('/') ? NATIVE_API_BASE + path : path;
}

// ---------------------------------------------------------------------
// Tokens der App-Sitzung
// ---------------------------------------------------------------------

const ACCESS_KEY = 'sprintlog.access';
const REFRESH_KEY = 'sprintlog.refresh';

let access: string | null = null;
let refresh: string | null = null;
let loading: Promise<void> | null = null;

const preferences = () => import('@capacitor/preferences').then((m) => m.Preferences);

/** Einmal beim Start: Tokens aus dem App-Speicher lesen (vor dem ersten API-Aufruf abwarten). */
export function loadNativeSession(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  loading ??= (async () => {
    try {
      const prefs = await preferences();
      access = (await prefs.get({ key: ACCESS_KEY })).value;
      refresh = (await prefs.get({ key: REFRESH_KEY })).value;
    } catch { /* ohne Speicher: neu anmelden */ }
  })();
  return loading;
}

export const nativeSession = {
  get accessToken() { return access; },
  get refreshToken() { return refresh; },
  get hasSession() { return !!refresh; },
  async save(nextAccess: string, nextRefresh: string): Promise<void> {
    access = nextAccess;
    refresh = nextRefresh;
    try {
      const prefs = await preferences();
      await prefs.set({ key: ACCESS_KEY, value: nextAccess });
      await prefs.set({ key: REFRESH_KEY, value: nextRefresh });
    } catch { /* bleibt bis zum Neustart im Speicher */ }
  },
  async clear(): Promise<void> {
    access = null;
    refresh = null;
    if (!isNative()) return;
    try {
      const prefs = await preferences();
      await prefs.remove({ key: ACCESS_KEY });
      await prefs.remove({ key: REFRESH_KEY });
    } catch { /* ignore */ }
  },
};

// ---------------------------------------------------------------------
// Native Extras
// ---------------------------------------------------------------------

/** Kurzes haptisches Feedback (Satz geloggt). iOS kennt navigator.vibrate nicht - nativ über die Taptic Engine. */
export function tap(): void {
  if (isNative()) {
    void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
  } else if (navigator.vibrate) {
    navigator.vibrate(15);
  }
}

/** Starkes Feedback am Ende der Pause. */
export function alarmHaptic(): void {
  if (!isNative()) return;
  void import('@capacitor/haptics').then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })).catch(() => {});
}

const REST_NOTIFICATION_ID = 4711;
let notificationsAllowed: boolean | null = null;

/**
 * Mitteilung zum Pausenende planen bzw. löschen. So meldet sich der Timer auch, wenn das iPhone gesperrt
 * ist oder die App im Hintergrund liegt (die WebView pausiert dann, ein JS-Timer würde nicht feuern).
 */
export async function scheduleRestNotification(endAt: number | null, text: { title: string; body: string }): Promise<void> {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    if (!endAt || endAt <= Date.now() + 1000) return;
    if (notificationsAllowed === null) {
      const status = await LocalNotifications.checkPermissions();
      notificationsAllowed = status.display === 'granted'
        || (status.display !== 'denied' && (await LocalNotifications.requestPermissions()).display === 'granted');
    }
    if (!notificationsAllowed) return;
    await LocalNotifications.schedule({
      notifications: [{ id: REST_NOTIFICATION_ID, title: text.title, body: text.body, schedule: { at: new Date(endAt), allowWhileIdle: true } }],
    });
  } catch { /* ohne Mitteilung: Timer läuft in der App weiter */ }
}

/** Display während einer Einheit wach halten (die Wake-Lock-API ist in der iOS-WebView nicht zuverlässig). */
export async function setKeepAwake(enabled: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (enabled) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch { /* ignore */ }
}

/** Statusleiste passend zum Farbschema (helle Schrift auf dunklem Theme und umgekehrt). */
export async function syncStatusBar(scheme: 'light' | 'dark'): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: scheme === 'dark' ? Style.Dark : Style.Light });
  } catch { /* ignore */ }
}
