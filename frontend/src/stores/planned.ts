// Geplante Einzel-Einheiten: Zustand, Offline-Speicher, Sync, Editor. Regeln und Rechnen in lib/planned.ts.
// Offline-first wie die Routinen: Änderungen sofort lokal (pending), dann idempotentes PUT/DELETE.
// Konflikt mit einem Plan-Tag prüft der Client vorher (Datumsauswahl); lehnt der Server trotzdem ab (409), wird zurückgenommen.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { intlLocale, t } from '../i18n';
import { isApiError, type Api } from '../lib/api';
import { createClientSync } from '../lib/clientSync';
import { readJson, userKeys, writeJson } from '../lib/storage';
import { localDay } from '../lib/wellness';
import { addDays, parseDay } from '../lib/routines';
import type { Schedule } from '../lib/schedule';
import {
  MAX_PLANNED_EXERCISES, byDay, freeDays, newPlannedId, past, planConflict, plannedToday, replacementOn, upcoming,
  type PlannedCategory, type PlannedExercise, type PlannedStatus, type PlannedWorkout,
} from '../lib/planned';
import { useUiStore } from './ui';

export interface PlannedSource {
  readonly userId: number | null;
  readonly online: boolean;
  readonly clockDate: Date;
  /** Wochenplan des aktiven Programms (für die Konfliktprüfung). */
  readonly schedule: Schedule | null;
  api(): Api;
  /** Einheit mit diesen Vorgaben starten (App-Store). */
  start(p: PlannedWorkout): Promise<boolean>;
}

export interface PlannedDraft {
  date: string;
  title: string;
  category: PlannedCategory;
  notes: string | null;
  exercises: PlannedExercise[];
  /** Ersetzt den Plan-Tag an diesem Datum (nur an Trainingstagen; sonst wird es eine normale Einheit). */
  replacesPlan?: boolean;
}

export interface PlannedEditor { open: boolean; clientId: string | null; draft: PlannedDraft }

const emptyDraft = (date: string): PlannedDraft => ({ date, title: '', category: 'Gym', notes: null, exercises: [] });

/** Eingaben säubern wie der Server (Grenzen, leere Werte raus). */
export function cleanPlanned(d: PlannedDraft): PlannedDraft {
  const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);
  return {
    date: d.date,
    title: d.title.trim().slice(0, 60),
    category: d.category === 'Football' ? 'Football' : 'Gym',
    notes: d.notes?.trim().slice(0, 300) || null,
    replacesPlan: !!d.replacesPlan,
    exercises: d.exercises.filter((x) => x.exerciseId > 0).slice(0, MAX_PLANNED_EXERCISES).map((x) => {
      const repsMin = num(x.repsMin, 1, 100);
      const repsMax = num(x.repsMax, 1, 100);
      return {
        exerciseId: x.exerciseId,
        sets: Math.max(1, Math.min(20, Math.round(x.sets || 1))),
        repsMin,
        repsMax: repsMin != null && repsMax != null && repsMax < repsMin ? repsMin : repsMax,
        weight: num(x.weight, 0.25, 1000),
        distance: num(x.distance, 1, 100_000),
        time: num(x.time, 1, 36_000),
        targetRpe: num(x.targetRpe, 1, 10),
        note: x.note?.trim().slice(0, 120) || null,
      };
    }),
  };
}

export const usePlannedStore = defineStore('planned', () => {
  const items = ref<PlannedWorkout[]>([]);
  const editor = ref<PlannedEditor>({ open: false, clientId: null, draft: emptyDraft(localDay()) });

  let source: (() => PlannedSource) | null = null;
  function connect(get: () => PlannedSource) { source = get; }
  const app = (): PlannedSource => {
    if (!source) throw new Error('planned store not connected');
    return source();
  };
  const key = () => { const id = source ? app().userId : null; return id ? userKeys(id).planned : null; };
  const persist = () => { const k = key(); if (k) writeJson(k, items.value); };

  const today = computed(() => localDay(source ? app().clockDate : new Date()));
  const schedule = computed(() => (source ? app().schedule : null));
  /** Heute offene Einheiten - ohne den Ersatz für den Plan-Tag (der steht oben als Haupt-Knopf). */
  const forToday = computed(() => plannedToday(items.value, today.value).filter((p) => !p.replacesPlan));
  /** Ersatz für den heutigen Plan-Tag (offen oder erledigt). */
  const replacementToday = computed(() => replacementOn(items.value, today.value));
  const next = computed(() => upcoming(items.value, today.value));
  const recent = computed(() => past(items.value, today.value));
  const perDay = computed(() => byDay(items.value));
  const byId = (id: string) => items.value.find((p) => p.clientId === id && p.pending !== 'delete') ?? null;
  /** Kollidiert ein offener Termin (inzwischen) mit dem Plan, z. B. nach einer Wochenplan-Änderung? */
  const conflictOf = (p: PlannedWorkout) => (p.status === 'planned' ? planConflict(schedule.value, p.date) : null);

  const sync = createClientSync<PlannedWorkout>({
    path: '/api/planned',
    items: () => items.value,
    setItems: (list) => { items.value = list; },
    persist,
    api: () => app().api(),
    body: ({ date, title, category, notes, exercises, status, workoutClientId, source: by, replacesPlan }) => ({ date, title, category, notes, exercises, status, workoutClientId, source: by, replacesPlan: !!replacesPlan }),
    onRejected: (p, e) => {
      console.warn('[planned] rejected', e);
      const conflict = isApiError(e) && e.status === 409;
      useUiStore().toast(t(conflict ? 'planned.toast.conflict' : 'planned.toast.rejected', { title: p.title }), 'error');
    },
  });
  const pushPending = () => sync.push();

  async function load() {
    const k = key();
    if (!k) return;
    items.value = readJson<PlannedWorkout[]>(k, []);
    if (app().online) await sync.pull();
  }

  function write(p: PlannedWorkout) {
    items.value = [p, ...items.value.filter((x) => x.clientId !== p.clientId)];
    persist();
    void pushPending();
  }

  /** Neu oder geändert speichern. null = Datum ist ein Spieltag (Hinweis wurde gezeigt). */
  function upsert(clientId: string, draft: PlannedDraft, by: PlannedWorkout['source'], status: PlannedStatus = 'planned'): PlannedWorkout | null {
    const existing = items.value.find((x) => x.clientId === clientId);
    const clean = cleanPlanned(draft);
    // Nur der Spieltag ist tabu; ein Trainingstag des Plans wird ein bewusster Doppeltag
    if (status === 'planned' && (!existing || existing.date !== clean.date) && planConflict(schedule.value, clean.date) === 'match') {
      useUiStore().toast(t('planned.toast.planDay'), 'error');
      return null;
    }
    const now = new Date().toISOString();
    // Ersatz nur, solange der Tag ein Trainingstag des Plans ist (sonst ganz normale Einheit)
    clean.replacesPlan = !!clean.replacesPlan && planConflict(schedule.value, clean.date) === 'training';
    const p: PlannedWorkout = {
      ...clean, clientId, status, source: existing?.source ?? by, workoutClientId: status === 'done' ? existing?.workoutClientId ?? null : null,
      createdAt: existing?.createdAt ?? now, updatedAt: now, pending: 'put',
    };
    write(p);
    return p;
  }

  function setStatus(clientId: string, status: PlannedStatus, workoutClientId: string | null = null) {
    const p = byId(clientId);
    if (!p) return;
    write({ ...p, status, workoutClientId: status === 'done' ? workoutClientId ?? p.workoutClientId : null, updatedAt: new Date().toISOString(), pending: 'put' });
  }

  /** Nach dem Speichern der Einheit (App-Store): Termin als erledigt markieren und verknüpfen. */
  const markDone = (clientId: string, workoutClientId: string) => setStatus(clientId, 'done', workoutClientId);

  async function skip(clientId: string) {
    const p = byId(clientId);
    if (!p) return;
    setStatus(clientId, 'skipped');
    useUiStore().toast(t('planned.toast.skipped', { title: p.title }), 'success');
  }

  /** Ersatz zurücknehmen: der Plan-Tag gilt an dem Datum wieder. */
  function restorePlanDay(clientId: string) {
    if (!byId(clientId)) return;
    setStatus(clientId, 'skipped');
    useUiStore().toast(t('planned.toast.restored'), 'success');
  }

  /** Auf den nächsten freien Tag (bzw. einen gewählten) verschieben. */
  function move(clientId: string, date?: string) {
    const p = byId(clientId);
    if (!p) return false;
    const target = date ?? freeDays(schedule.value, items.value, addDays(p.date < today.value ? today.value : p.date, p.date < today.value ? 0 : 1), 1, clientId)[0]?.day;
    if (!target) return false;
    const r = upsert(clientId, { ...p, date: target }, p.source, 'planned');
    if (r) useUiStore().toast(t('planned.toast.moved', { title: p.title, date: target }), 'success');
    return !!r;
  }

  async function start(clientId: string) {
    const p = byId(clientId);
    return p ? app().start(p) : false;
  }

  /** Vorschlag des Coachs übernehmen. */
  function applyFromCoach(session: PlannedDraft & { status?: PlannedStatus }, replacesId: string | null): boolean {
    const target = replacesId && byId(replacesId) ? replacesId : newPlannedId();
    const status = session.status === 'skipped' ? 'skipped' : 'planned';
    const r = upsert(target, session, 'coach', status);
    if (r) {
      // Bestätigung mit Datum: "Добавлено в календарь: пт, 20 нояб." - und was es ist (Ersatz/Doppeltag/frei)
      const when = parseDay(r.date).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
      const key = status === 'skipped' ? 'planned.toast.skipped'
        : r.replacesPlan ? 'planned.toast.replaced'
        : planConflict(schedule.value, r.date) === 'training' ? 'planned.toast.addedDouble'
        : replacesId ? 'planned.toast.updated' : 'planned.toast.addedOn';
      useUiStore().toast(t(key, { title: r.title, date: when }), 'success');
    }
    return !!r;
  }

  // ---------- Editor ----------

  function openNew(date?: string) {
    const day = date && date >= today.value && planConflict(schedule.value, date) !== 'match' ? date : freeDays(schedule.value, items.value, addDays(today.value, 1), 1)[0]?.day ?? today.value;
    editor.value = { open: true, clientId: null, draft: emptyDraft(day) };
  }
  function openEdit(clientId: string) {
    const p = byId(clientId);
    if (!p) return;
    editor.value = { open: true, clientId, draft: { date: p.date, title: p.title, category: p.category, notes: p.notes, replacesPlan: !!p.replacesPlan, exercises: p.exercises.map((x) => ({ ...x })) } };
  }
  function close() { editor.value = { ...editor.value, open: false }; }

  function save(): boolean {
    const e = editor.value;
    const clean = cleanPlanned(e.draft);
    if (!clean.title || !clean.exercises.length) return false;
    const existing = e.clientId ? byId(e.clientId) : null;
    const r = upsert(e.clientId ?? newPlannedId(), clean, 'user', existing?.status === 'done' ? 'done' : 'planned');
    if (!r) return false;
    close();
    useUiStore().toast(t(e.clientId ? 'planned.toast.updated' : 'planned.toast.added', { title: r.title }), 'success');
    return true;
  }

  async function remove(clientId: string) {
    const p = byId(clientId);
    if (!p) return;
    const ok = await useUiStore().confirm({ title: t('planned.confirm.title'), message: t('planned.confirm.message', { title: p.title }), confirmText: t('common.remove'), danger: true });
    if (!ok) return;
    items.value = items.value.map((x) => (x.clientId === clientId ? { ...x, pending: 'delete' as const } : x));
    persist();
    close();
    await pushPending();
  }

  function clear() { items.value = []; editor.value = { open: false, clientId: null, draft: emptyDraft(localDay()) }; }

  return {
    connect, items, editor, today, schedule, forToday, replacementToday, next, recent, perDay, byId, conflictOf, load, pushPending,
    upsert, setStatus, markDone, skip, restorePlanDay, move, start, applyFromCoach, openNew, openEdit, close, save, remove, clear,
  };
});
