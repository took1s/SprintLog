// Apple Health (nur iPhone-App): Tageswerte (Schlaf, Ruhepuls, HRV, Schritte) in die Tageswerte übernehmen und Workouts
// der Uhr den erfassten Einheiten zuordnen (Distanz, Puls, Höchstgeschwindigkeit, Sprints). Uhr-Workouts ohne passende
// Einheit (z. B. Fußball) werden angeboten - "als Spiel erfassen" füllt Minuten und Werte vor.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { isNative } from '../lib/native';
import { readJson, writeJson } from '../lib/storage';
import type { Workout, WorkoutHealth } from '../types';
import { useAppStore } from './app';
import { useAthleteStore } from './athlete';

interface HealthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ granted: boolean }>;
  dailySummaries(o: { days: number }): Promise<{ days: HealthDay[] }>;
  workouts(o: { days: number }): Promise<{ workouts: WatchWorkout[] }>;
}
export interface HealthDay { day: string; sleepMinutes?: number; restingHr?: number; hrv?: number; steps?: number }
export interface WatchWorkout {
  start: string; end: string; durationSeconds: number; activity: 'soccer' | 'running' | 'strength' | 'hiit' | 'cycling' | 'other';
  distanceM?: number; calories?: number; avgHr?: number; maxHr?: number; maxSpeedKmh?: number; sprints?: number;
}

let plugin: Promise<HealthPlugin> | null = null;
const native = () => (plugin ??= import('@capacitor/core').then((m) => m.registerPlugin<HealthPlugin>('Health')));
const PREFS = 'sprintlog:health';
/** Höchstens alle 30 Minuten automatisch abgleichen. */
const AUTO_EVERY = 30 * 60_000;
/** Uhr-Workout gehört zu einer Einheit, wenn die Startzeiten höchstens 90 Minuten auseinander liegen. */
const MATCH_WINDOW = 90 * 60_000;

export const healthOf = (w: WatchWorkout): WorkoutHealth => ({
  distanceM: w.distanceM ?? null, avgHr: w.avgHr ?? null, maxHr: w.maxHr ?? null, maxSpeedKmh: w.maxSpeedKmh ?? null, sprints: w.sprints ?? null,
});

/** Einheit zum Uhr-Workout: gleiche Zeit (±90 min), Krafttraining nur zu Gym, Fußball/Lauf zu Spiel/Feld/Hybrid. */
export function matchWorkout(w: WatchWorkout, workouts: readonly Workout[]): Workout | null {
  const start = new Date(w.start).getTime();
  const fits = (x: Workout) => (w.activity === 'strength' ? x.workoutType === 'Gym' || x.workoutType === 'Hybrid' : x.workoutType !== 'Gym' || w.activity === 'hiit' || w.activity === 'other');
  let best: Workout | null = null, bestGap = Infinity;
  for (const x of workouts) {
    const gap = Math.abs(new Date(x.date).getTime() - start);
    if (gap <= MATCH_WINDOW && gap < bestGap && fits(x)) { best = x; bestGap = gap; }
  }
  return best;
}

export const useHealthStore = defineStore('health', () => {
  const stored = readJson<{ connected?: boolean; lastSync?: number }>(PREFS, {});
  const available = ref(false);
  const connected = ref(!!stored.connected);
  const lastSync = ref<number | null>(stored.lastSync ?? null);
  const busy = ref(false);
  const error = ref<string | null>(null);
  /** Uhr-Workouts ohne passende Einheit (Fußball, Lauf) der letzten 14 Tage. */
  const unmatched = ref<WatchWorkout[]>([]);
  const dismissed = ref<string[]>(readJson<string[]>(`${PREFS}:dismissed`, []));
  const offers = computed(() => unmatched.value.filter((w) => !dismissed.value.includes(w.start) && (w.activity === 'soccer' || w.activity === 'running') && w.durationSeconds >= 20 * 60));

  const persist = () => writeJson(PREFS, { connected: connected.value, lastSync: lastSync.value });

  async function detect() {
    if (!isNative()) { available.value = false; return; }
    try { available.value = (await (await native()).isAvailable()).available; } catch { available.value = false; }
  }

  async function connect(): Promise<boolean> {
    error.value = null;
    try {
      await (await native()).requestAuthorization();
      connected.value = true;
      persist();
      await sync();
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return false;
    }
  }

  function disconnect() {
    connected.value = false;
    unmatched.value = [];
    persist();
  }

  async function sync() {
    if (!connected.value || busy.value) return;
    busy.value = true;
    error.value = null;
    try {
      const h = await native();
      const athlete = useAthleteStore();
      const { days } = await h.dailySummaries({ days: 14 });
      for (const d of days) {
        const cur = athlete.daily.find((x) => x.day === d.day);
        const patch = { sleepMinutes: d.sleepMinutes ?? null, restingHr: d.restingHr ?? null, hrv: d.hrv ?? null, steps: d.steps ?? null };
        // Nur senden, wenn sich etwas geändert hat (kein Sync-Rauschen)
        if (!cur || (Object.keys(patch) as (keyof typeof patch)[]).some((k) => (cur[k] ?? null) !== patch[k])) athlete.setDaily(d.day, patch);
      }
      const app = useAppStore();
      const { workouts } = await h.workouts({ days: 14 });
      const left: WatchWorkout[] = [];
      for (const w of workouts) {
        const target = matchWorkout(w, app.allWorkouts);
        if (!target) { left.push(w); continue; }
        const health = healthOf(w);
        const empty = Object.values(health).every((v) => v == null);
        if (!empty && target.id && !target.pending && JSON.stringify(target.health ?? null) !== JSON.stringify(health)) await app.setWorkoutHealth(target.id, health);
      }
      unmatched.value = left;
      lastSync.value = Date.now();
      persist();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      busy.value = false;
    }
  }

  /** Beim Start und beim Zurückkehren in die App - höchstens alle 30 Minuten. */
  async function start() {
    await detect();
    if (!available.value || !connected.value) return;
    // Erst die Einheiten laden lassen, sonst passt kein Uhr-Workout zu einer Einheit
    await new Promise((r) => window.setTimeout(r, 3000));
    if (!lastSync.value || Date.now() - lastSync.value > AUTO_EVERY) await sync();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && connected.value && (!lastSync.value || Date.now() - lastSync.value > AUTO_EVERY)) void sync();
    });
  }

  function dismiss(w: WatchWorkout) {
    dismissed.value = [...dismissed.value.slice(-50), w.start];
    writeJson(`${PREFS}:dismissed`, dismissed.value);
  }

  /** Fußball-Workout der Uhr als Spiel erfassen (Minuten, Zeit und Werte vorbelegt). */
  function logAsMatch(w: WatchWorkout) {
    useAppStore().openMatchModal(undefined, { date: w.start, minutes: Math.round(w.durationSeconds / 60), health: healthOf(w) });
    dismiss(w);
  }

  return { available, connected, lastSync, busy, error, unmatched, offers, detect, connect, disconnect, sync, start, dismiss, logAsMatch };
});
