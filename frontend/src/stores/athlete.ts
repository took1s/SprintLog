// Athletendaten neben dem Training: Leistungstests (alle 6-8 Wochen) und Tageswerte (Gewicht, Eiweiß; Schlaf, Ruhepuls,
// HRV, Schritte aus Apple Health). Offline-first wie Routinen: lokal sofort, idempotent nachgesendet.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Api } from '../lib/api';
import { t } from '../i18n';
import { createClientSync, isNetworkError, newClientId } from '../lib/clientSync';
import { RETEST_DUE, testDue, type TestId, type TestResult } from '../lib/fitnessTests';
import { addDays } from '../lib/routines';
import { readJson, userKeys, writeJson } from '../lib/storage';
import { localDay } from '../lib/wellness';
import { useUiStore } from './ui';
import { useAiStore } from './ai';

export interface AthleteSource {
  readonly userId: number | null;
  readonly online: boolean;
  readonly clockDate: Date;
  api(): Api;
}

export interface DailyLog {
  day: string;
  weightKg?: number | null;
  proteinG?: number | null;
  sleepMinutes?: number | null;
  restingHr?: number | null;
  hrv?: number | null;
  steps?: number | null;
  updatedAt?: string;
  pending?: boolean;
}

export const DAILY_FIELDS = ['weightKg', 'proteinG', 'sleepMinutes', 'restingHr', 'hrv', 'steps'] as const;
export type DailyField = (typeof DAILY_FIELDS)[number];

/** Eiweiß-Ziel 1,6-2,2 g/kg (Sporternährung); Mitte als Tagesziel. */
export const proteinTarget = (weightKg: number | null | undefined): { min: number; max: number; goal: number } | null =>
  weightKg ? { min: Math.round(weightKg * 1.6), max: Math.round(weightKg * 2.2), goal: Math.round(weightKg * 1.8 / 5) * 5 } : null;

/** Gleitender 7-Tage-Mittelwert des Gewichts (Tagesschwankungen von 1-2 kg glätten). */
export function weightTrend(logs: readonly DailyLog[], today: string, days = 56): { day: string; value: number | null; avg: number | null }[] {
  const byDay = new Map(logs.filter((l) => l.weightKg != null).map((l) => [l.day, l.weightKg!]));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    const window = Array.from({ length: 7 }, (_, k) => byDay.get(addDays(day, -k))).filter((x): x is number => x != null);
    return { day, value: byDay.get(day) ?? null, avg: window.length ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10 : null };
  });
}

export const useAthleteStore = defineStore('athlete', () => {
  const tests = ref<TestResult[]>([]);
  const daily = ref<DailyLog[]>([]);
  /** Eingabe eines Testtags (Sheet). */
  const testSheet = ref<{ open: boolean; day: string; only: TestId | null }>({ open: false, day: localDay(), only: null });

  let source: (() => AthleteSource) | null = null;
  function connect(get: () => AthleteSource) { source = get; }
  const app = (): AthleteSource => {
    if (!source) throw new Error('athlete store not connected');
    return source();
  };
  const keys = () => { const id = source ? app().userId : null; return id ? userKeys(id) : null; };
  const persistTests = () => { const k = keys(); if (k) writeJson(k.fitnessTests, tests.value); };
  const persistDaily = () => { const k = keys(); if (k) writeJson(k.daily, daily.value); };

  const today = computed(() => localDay(source ? app().clockDate : new Date()));
  const due = computed(() => testDue(tests.value, today.value));
  const todayLog = computed(() => daily.value.find((d) => d.day === today.value) ?? null);

  // ---------- Leistungstests ----------

  const testSync = createClientSync<TestResult>({
    path: '/api/fitness-tests',
    items: () => tests.value,
    setItems: (list) => { tests.value = list; },
    persist: persistTests,
    api: () => app().api(),
    body: ({ day, test, value, notes }) => ({ day, test, value, notes }),
    onRejected: (_r, e) => { console.warn('[tests] rejected', e); useUiStore().toast(t('tests.toast.rejected'), 'error'); },
  });

  /** Ergebnisse eines Testtags speichern; ein Ergebnis je Test und Tag (gleicher Tag = ersetzen). */
  function saveResults(day: string, values: Partial<Record<TestId, number | null>>) {
    const now = new Date().toISOString();
    let list = [...tests.value];
    let saved = 0;
    for (const [test, value] of Object.entries(values) as [TestId, number | null][]) {
      const existing = list.find((r) => r.test === test && r.day === day && r.pending !== 'delete');
      if (value == null || !Number.isFinite(value)) {
        if (existing) list = list.map((r) => (r === existing ? { ...r, pending: 'delete' as const, updatedAt: now } : r));
        continue;
      }
      saved++;
      const next: TestResult = { clientId: existing?.clientId ?? newClientId('ft'), day, test, value, notes: existing?.notes ?? null, updatedAt: now, pending: 'put' };
      list = existing ? list.map((r) => (r === existing ? next : r)) : [...list, next];
    }
    tests.value = list;
    persistTests();
    void testSync.push();
    return saved;
  }

  function removeResult(clientId: string) {
    tests.value = tests.value.map((r) => (r.clientId === clientId ? { ...r, pending: 'delete' as const, updatedAt: new Date().toISOString() } : r));
    persistTests();
    void testSync.push();
  }

  const openTests = (only: TestId | null = null) => { testSheet.value = { open: true, day: today.value, only }; };
  const closeTests = () => { testSheet.value = { ...testSheet.value, open: false }; };

  // ---------- Tageswerte ----------

  let pushing: Promise<void> | null = null;
  async function pushDaily(): Promise<void> {
    if (pushing) { await pushing; if (!daily.value.some((d) => d.pending)) return; }
    pushing = (async () => {
      for (const d of daily.value.filter((x) => x.pending)) {
        const sent = d.updatedAt;
        try {
          const body = Object.fromEntries(DAILY_FIELDS.map((f) => [f, d[f] ?? null]));
          await app().api().put(`/api/daily/${d.day}`, body);
          daily.value = daily.value.map((x) => (x.day === d.day && x.updatedAt === sent ? { ...x, pending: false } : x));
        } catch (e) {
          if (isNetworkError(e)) break;
          console.warn('[daily] rejected', e);
          daily.value = daily.value.map((x) => (x.day === d.day ? { ...x, pending: false } : x));
        }
      }
      persistDaily();
    })().finally(() => { pushing = null; });
    return pushing;
  }

  /** Werte eines Tages setzen (nur übergebene Felder; null = leeren). */
  function setDaily(day: string, patch: Partial<Pick<DailyLog, DailyField>>) {
    const existing = daily.value.find((d) => d.day === day);
    const next: DailyLog = { ...(existing ?? { day }), ...patch, updatedAt: new Date().toISOString(), pending: true };
    daily.value = existing ? daily.value.map((d) => (d.day === day ? next : d)) : [...daily.value, next].sort((a, b) => a.day.localeCompare(b.day));
    persistDaily();
    void pushDaily();
  }

  /** Eiweiß hinzufügen (Schnellknöpfe); negativ = korrigieren, nie unter 0. */
  function addProtein(grams: number, day = today.value) {
    const cur = daily.value.find((d) => d.day === day)?.proteinG ?? 0;
    setDaily(day, { proteinG: Math.max(0, Math.min(600, cur + grams)) });
  }

  const latestWeight = computed(() => [...daily.value].reverse().find((d) => d.weightKg != null)?.weightKg ?? useAiStore().profile.weightKg ?? null);
  const protein = computed(() => ({ today: todayLog.value?.proteinG ?? 0, target: proteinTarget(latestWeight.value) }));

  // ---------- Laden ----------

  async function load() {
    const k = keys();
    if (!k) return;
    tests.value = readJson<TestResult[]>(k.fitnessTests, []);
    daily.value = readJson<DailyLog[]>(k.daily, []);
    if (!app().online) return;
    await testSync.pull();
    try {
      await pushDaily();
      const fresh = await app().api().get<DailyLog[]>('/api/daily?days=180');
      const pending = daily.value.filter((d) => d.pending);
      daily.value = [...pending, ...fresh.filter((f) => !pending.some((p) => p.day === f.day))].sort((a, b) => a.day.localeCompare(b.day));
      persistDaily();
    } catch (e) {
      if (!isNetworkError(e)) console.warn('[daily]', e);
    }
  }

  async function pushPending() { await Promise.allSettled([testSync.push(), pushDaily()]); }

  function clear() { tests.value = []; daily.value = []; testSheet.value = { open: false, day: localDay(), only: null }; }

  return {
    connect, tests, daily, today, due, todayLog, testSheet, latestWeight, protein,
    saveResults, removeResult, openTests, closeTests, setDaily, addProtein, load, pushPending, clear,
    RETEST_DUE,
  };
});
