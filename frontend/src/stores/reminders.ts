// Erinnerungen verschicken: in der iPhone-App als lokale Mitteilungen (kommen auch offline und bei gesperrtem Bildschirm),
// im Browser nur, solange SprintLog offen ist (Web hat keine geplanten Mitteilungen ohne Server-Push).
// Einstellungen gelten pro Gerät. Neu geplant wird bei jeder Änderung an Routinen, Zusatz-Einheiten, Plan oder Sprache.
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { locale, t, tn } from '../i18n';
import { isNative } from '../lib/native';
import { DEFAULT_REMINDER_PREFS, planReminders, type Reminder, type ReminderPrefs, type ReminderTexts } from '../lib/reminders';
import { isTime } from '../lib/routines';
import { readJson, writeJson } from '../lib/storage';
import { useAppStore } from './app';
import { usePlannedStore } from './planned';
import { useRoutinesStore } from './routines';

const PREFS_KEY = 'sprintlog:reminders';
/** Ids eigener Erinnerungen (siehe reminderId); darunter liegen feste Mitteilungen wie der Pausen-Timer. */
const isReminderId = (id: number) => id >= 100_000;

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

const notifications = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);

export const useRemindersStore = defineStore('reminders', () => {
  const stored = readJson<Partial<ReminderPrefs>>(PREFS_KEY, {});
  const prefs = ref<ReminderPrefs>({
    ...DEFAULT_REMINDER_PREFS, ...stored,
    routineTime: isTime(stored.routineTime) ? stored.routineTime : DEFAULT_REMINDER_PREFS.routineTime,
    todayTime: isTime(stored.todayTime) ? stored.todayTime : DEFAULT_REMINDER_PREFS.todayTime,
    reportTime: isTime(stored.reportTime) ? stored.reportTime : DEFAULT_REMINDER_PREFS.reportTime,
    checkInTime: isTime(stored.checkInTime) ? stored.checkInTime : DEFAULT_REMINDER_PREFS.checkInTime,
  });
  const permission = ref<ReminderPermission>('prompt');
  const scheduled = ref<Reminder[]>([]);
  /** Antippen einer Mitteilung: Routine aufklappen bzw. Startbildschirm zeigen. */
  const focus = ref<{ kind: Reminder['kind']; target: string | null; at: number } | null>(null);

  const supported = computed(() => isNative() || (typeof window !== 'undefined' && 'Notification' in window));
  /** Im Browser nur bei offener App - wird in den Einstellungen gesagt. */
  const webOnly = computed(() => !isNative());

  async function readPermission(): Promise<ReminderPermission> {
    try {
      if (isNative()) {
        const s = (await (await notifications()).checkPermissions()).display;
        return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
      }
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission === 'default' ? 'prompt' : Notification.permission;
    } catch { return 'unsupported'; }
  }

  async function requestPermission(): Promise<ReminderPermission> {
    try {
      if (isNative()) {
        const s = (await (await notifications()).requestPermissions()).display;
        permission.value = s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
      } else if ('Notification' in window) {
        const s = await Notification.requestPermission();
        permission.value = s === 'default' ? 'prompt' : s;
      } else permission.value = 'unsupported';
    } catch { permission.value = 'unsupported'; }
    return permission.value;
  }

  /** Einschalten fragt nach der Erlaubnis; ohne Erlaubnis bleibt es aus. */
  async function setEnabled(on: boolean) {
    if (on && (await requestPermission()) !== 'granted') { prefs.value = { ...prefs.value, enabled: false }; return; }
    prefs.value = { ...prefs.value, enabled: on };
  }
  function update(patch: Partial<ReminderPrefs>) { prefs.value = { ...prefs.value, ...patch }; }

  // ---------- Texte ----------

  const texts: ReminderTexts = {
    routine: (r, k, slot) => {
      const steps = r.steps.slice(0, 3).map((s) => s.name).join(' · ');
      const where = r.timesPerDay <= 1 ? '' : slot ? t('reminders.notif.round', { slot: t(`routines.slots.${slot}`), k, n: r.timesPerDay }) : t('reminders.notif.roundPlain', { k, n: r.timesPerDay });
      return { title: r.title, body: [where, steps].filter(Boolean).join(' - ') };
    },
    planned: (p) => ({ title: t('reminders.notif.plannedTitle', { title: p.title }), body: tn('reminders.notif.plannedBody', p.exercises.length) }),
    training: () => {
      const app = useAppStore();
      const next = app.programInfo?.next?.name;
      return { title: t('reminders.notif.trainingTitle'), body: next ? t('reminders.notif.trainingBody', { name: next }) : t('reminders.notif.trainingBodyPlain') };
    },
    match: () => ({ title: t('reminders.notif.matchTitle'), body: t('reminders.notif.matchBody') }),
    report: () => ({ title: t('reminders.notif.reportTitle'), body: t('reminders.notif.reportBody') }),
    checkIn: () => ({ title: t('reminders.notif.checkInTitle'), body: t('reminders.notif.checkInBody') }),
  };

  // ---------- Planen ----------

  let webTimers: number[] = [];
  let timer: number | null = null;
  let listening = false;

  function plan(): Reminder[] {
    const app = useAppStore();
    return planReminders({
      now: new Date(), prefs: prefs.value, routines: useRoutinesStore().routines, planned: usePlannedStore().items,
      schedule: app.activeProgram ?? null, texts, checkedInToday: !!app.todayWellness,
    });
  }

  async function apply(list: Reminder[]) {
    scheduled.value = list;
    if (isNative()) {
      try {
        const ln = await notifications();
        const pending = (await ln.getPending()).notifications.filter((n) => isReminderId(n.id));
        if (pending.length) await ln.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
        if (list.length && permission.value === 'granted') {
          await ln.schedule({
            notifications: list.map((r) => ({
              id: r.id, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true },
              extra: { sl: 'reminder', kind: r.kind, target: r.target }, threadIdentifier: `sprintlog-${r.kind}`,
            })),
          });
        }
      } catch (e) { console.warn('[reminders]', e); }
      return;
    }
    // Browser: nur was in den nächsten 24 h fällig wird, solange die Seite offen ist
    webTimers.forEach((id) => window.clearTimeout(id));
    webTimers = [];
    if (permission.value !== 'granted') return;
    const now = Date.now();
    for (const r of list) {
      const wait = r.at.getTime() - now;
      if (wait > 24 * 3_600_000) break;
      webTimers.push(window.setTimeout(() => void showWeb(r), wait));
    }
  }

  async function showWeb(r: Reminder) {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const options = { body: r.body, tag: `sprintlog-${r.id}`, icon: '/brand/icon.svg', data: { sl: 'reminder', kind: r.kind, target: r.target } };
      if (reg) await reg.showNotification(r.title, options);
      else {
        const n = new Notification(r.title, options);
        n.onclick = () => { window.focus(); open(r.kind, r.target); n.close(); };
      }
    } catch (e) { console.warn('[reminders] web', e); }
  }

  /** Neu planen (gebündelt: viele Änderungen kurz hintereinander -> einmal). */
  function reschedule(delay = 1200) {
    if (timer != null) window.clearTimeout(timer);
    timer = window.setTimeout(() => { timer = null; void apply(plan()); }, delay);
  }

  function open(kind: Reminder['kind'], target: string | null) {
    focus.value = { kind, target, at: Date.now() };
  }

  /** Einmal nach der Anmeldung: Erlaubnis lesen, auf Änderungen hören, Antippen verarbeiten. */
  async function start() {
    permission.value = await readPermission();
    if (prefs.value.enabled && permission.value !== 'granted') prefs.value = { ...prefs.value, enabled: false };
    if (!listening) {
      listening = true;
      const app = useAppStore();
      const routines = useRoutinesStore();
      const planned = usePlannedStore();
      watch(() => [routines.routines, planned.items, app.activeProgram?.trainingDays, app.activeProgram?.matchDays, app.programInfo?.next?.name, locale.value, app.clockDate.toDateString(), !!app.todayWellness],
        () => reschedule(), { deep: false });
      watch(prefs, (p) => { writeJson(PREFS_KEY, p); reschedule(300); }, { deep: true });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reschedule(); });
      if (isNative()) {
        try {
          const ln = await notifications();
          await ln.addListener('localNotificationActionPerformed', (e) => {
            const x = e.notification.extra as { sl?: string; kind?: Reminder['kind']; target?: string | null } | undefined;
            if (x?.sl === 'reminder' && x.kind) open(x.kind, x.target ?? null);
          });
        } catch { /* ohne Listener: Antippen öffnet nur die App */ }
      } else {
        navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
          const x = e.data as { type?: string; kind?: Reminder['kind']; target?: string | null };
          if (x?.type === 'reminder' && x.kind) open(x.kind, x.target ?? null);
        });
      }
    }
    reschedule(0);
  }

  /** Abmelden: geplante Mitteilungen löschen (enthalten Namen der Routinen). */
  async function clear() {
    if (timer != null) window.clearTimeout(timer);
    timer = null;
    await apply([]);
  }

  async function test() {
    const now = new Date(Date.now() + 5000);
    const r: Reminder = { id: 99_999, at: now, kind: 'today', target: null, title: t('reminders.testTitle'), body: t('reminders.testBody') };
    if (isNative()) {
      try { await (await notifications()).schedule({ notifications: [{ id: r.id, title: r.title, body: r.body, schedule: { at: now, allowWhileIdle: true } }] }); } catch { /* ignore */ }
    } else window.setTimeout(() => void showWeb(r), 5000);
  }

  return { prefs, permission, scheduled, focus, supported, webOnly, setEnabled, update, reschedule, start, clear, test, open };
});
