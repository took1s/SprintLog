// Routinen (Dehnen, Reha, Prävention): Zustand, Offline-Speicher und Sync. Rechenlogik in lib/routines.ts.
//
// Offline-first wie bei den Zielen: jede Änderung (auch der Erledigt-Haken) landet sofort lokal (pending) und wird per
// PUT/DELETE nachgereicht. Beide Requests sind idempotent (Client-Id), ein Wiederholen nach Funkloch ist also unkritisch.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { t } from '../i18n';
import type { Api } from '../lib/api';
import { createClientSync } from '../lib/clientSync';
import { readJson, userKeys, writeJson } from '../lib/storage';
import { localDay } from '../lib/wellness';
import {
  EVERY_DAY, MAX_TIMES_PER_DAY, doneCount, fillTimes, newRoutineId, painOn, routineProgress, setDoneCount, setPainLevel, sortRoutines, tapCount,
  todaysRoutines, tracksPain, type Routine, type RoutineKind, type RoutineStep,
} from '../lib/routines';
import { useUiStore } from './ui';

/** Was der Routinen-Store vom App-Store braucht (Schnittstelle statt Import: kein Typ-Zirkel). */
export interface RoutinesSource {
  readonly userId: number | null;
  readonly online: boolean;
  readonly clockDate: Date;
  api(): Api;
}

/** Inhalt einer Routine ohne Verwaltungsfelder - so kommt sie aus dem Editor oder vom Coach. */
export interface RoutineDraft {
  title: string;
  kind: RoutineKind;
  days: number;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  steps: RoutineStep[];
  timesPerDay: number;
  /** Uhrzeit je Durchgang ("HH:mm"); leer = ohne feste Zeit. */
  times: string[];
}

export interface RoutineEditor {
  open: boolean;
  /** Bearbeitete Routine; null = neu. */
  clientId: string | null;
  draft: RoutineDraft;
}

export const emptyRoutine = (today: string): RoutineDraft => ({
  title: '', kind: 'mobility', days: EVERY_DAY, startDate: today, endDate: null, reason: null, steps: [{ name: '', dose: '' }], timesPerDay: 1, times: [],
});

/** Eingaben säubern: leere Schritte raus, Längen wie auf dem Server. */
export function cleanDraft(d: RoutineDraft): RoutineDraft {
  const clip = (s: string | null | undefined, max: number) => (s ?? '').trim().slice(0, max);
  return {
    title: clip(d.title, 60),
    kind: d.kind,
    days: d.days & EVERY_DAY || EVERY_DAY,
    startDate: d.startDate,
    endDate: d.endDate && d.endDate >= d.startDate ? d.endDate : null,
    reason: clip(d.reason, 300) || null,
    steps: d.steps.map((s) => ({ name: clip(s.name, 80), dose: clip(s.dose, 60) || null, exerciseId: s.exerciseId ?? null })).filter((s) => s.name).slice(0, 12),
    timesPerDay: Math.max(1, Math.min(MAX_TIMES_PER_DAY, Math.round(d.timesPerDay || 1))),
    times: fillTimes(d.times, Math.round(d.timesPerDay || 1)),
  };
}

/** Felder älterer Stände ergänzen (lokaler Speicher, ältere Server-Antworten). */
// Uhrzeiten auf die Anzahl Durchgänge auffüllen (ältere bzw. vom Coach unvollständig angelegte Routinen) - geht beim nächsten Senden mit
const normalize = (r: Routine): Routine => ({ ...r, timesPerDay: r.timesPerDay || 1, times: fillTimes(r.times ?? [], r.timesPerDay || 1), pain: r.pain ?? [] });

const capPerDay = (dates: readonly string[], max: number): string[] => {
  const seen = new Map<string, number>();
  return dates.filter((d) => { const n = (seen.get(d) ?? 0) + 1; seen.set(d, n); return n <= max; });
};

/** Stand eines angefangenen Durchgangs im Player. */
export interface PlayerProgress {
  clientId: string;
  day: string;
  /** 1-basierter Durchgang des Tages. */
  round: number;
  /** Phase, bei der es weitergeht, und Restzeit (ms) der Timer-Phase. */
  index: number;
  left: number | null;
  phases: number;
}

export const useRoutinesStore = defineStore('routines', () => {
  const routines = ref<Routine[]>([]);
  const editor = ref<RoutineEditor>({ open: false, clientId: null, draft: emptyRoutine(localDay()) });

  let source: (() => RoutinesSource) | null = null;
  function connect(get: () => RoutinesSource) { source = get; }
  const app = (): RoutinesSource => {
    if (!source) throw new Error('routines store not connected');
    return source();
  };
  const key = () => { const id = source ? app().userId : null; return id ? userKeys(id).routines : null; };
  const persist = () => { const k = key(); if (k) writeJson(k, routines.value); };

  const today = computed(() => localDay(source ? app().clockDate : new Date()));
  const visible = computed(() => sortRoutines(routines.value, today.value));
  const forToday = computed(() => todaysRoutines(routines.value, today.value));
  const progressOf = (r: Routine) => routineProgress(r, today.value);
  const byId = (id: string) => routines.value.find((r) => r.clientId === id && r.pending !== 'delete') ?? null;

  const sync = createClientSync<Routine>({
    path: '/api/routines',
    items: () => routines.value,
    // Server älterer Version liefert times/pain evtl. nicht
    setItems: (list) => { routines.value = list.map(normalize); },
    persist,
    api: () => app().api(),
    body: ({ title, kind, days, startDate, endDate, reason, steps, doneDates, source: by, timesPerDay, times, pain }) =>
      ({ title, kind, days, startDate, endDate, reason, steps, doneDates, source: by, timesPerDay, times, pain }),
    onRejected: (r, e) => {
      console.warn('[routines] rejected', e);
      useUiStore().toast(t('routines.toast.rejected', { title: r.title }), 'error');
    },
  });
  const pushPending = () => sync.push();

  async function load() {
    const k = key();
    if (!k) return;
    const pk = playerKey();
    saved.value = pk ? readJson<PlayerProgress | null>(pk, null) : null;
    // Ältere lokale Stände ohne timesPerDay/times/pain: einmal täglich, ohne Zeiten
    routines.value = readJson<Routine[]>(k, []).map(normalize);
    if (app().online) await sync.pull();
  }

  function upsert(clientId: string, draft: RoutineDraft, by: Routine['source'], keepDone = true): Routine {
    const existing = routines.value.find((r) => r.clientId === clientId);
    const now = new Date().toISOString();
    const clean = cleanDraft(draft);
    const routine: Routine = {
      ...clean,
      clientId,
      source: existing?.source ?? by,
      // Weniger Durchgänge pro Tag als vorher: überzählige Haken je Tag kürzen
      doneDates: keepDone ? capPerDay(existing?.doneDates ?? [], clean.timesPerDay) : [],
      pain: keepDone ? existing?.pain ?? [] : [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      pending: 'put',
    };
    routines.value = [routine, ...routines.value.filter((r) => r.clientId !== clientId)];
    persist();
    void pushPending();
    return routine;
  }

  /** Vorschlag des Coachs übernehmen (neu oder Änderung einer bestehenden Routine). */
  function applyFromCoach(draft: RoutineDraft, replacesId: string | null): Routine {
    const target = replacesId && byId(replacesId) ? replacesId : newRoutineId();
    const r = upsert(target, draft, 'coach');
    useUiStore().toast(t(replacesId ? 'routines.toast.updated' : 'routines.toast.added', { title: r.title }), 'success');
    return r;
  }

  /** Durchgänge eines Tages setzen (0 ... timesPerDay) - für den Haken, das Nachtragen und den Verlauf. */
  function setCount(clientId: string, n: number, day = today.value) {
    const r = routines.value.find((x) => x.clientId === clientId);
    if (!r || day > today.value || doneCount(r, day) === n) return;
    const before = doneCount(r, day);
    const doneDates = setDoneCount(r, day, n);
    routines.value = routines.value.map((x) => (x.clientId === clientId ? { ...x, doneDates, updatedAt: new Date().toISOString(), pending: 'put' as const } : x));
    persist();
    void pushPending();
    // Reha: beim ersten Haken des Tages nach dem Schmerz fragen (einmal pro Tag, überspringbar)
    if (tracksPain(r) && before === 0 && n > 0 && painOn(r, day) == null) painAsk.value = { clientId, day };
    else if (painAsk.value?.clientId === clientId && n === 0) painAsk.value = null;
  }

  // ---------- Schmerz (Reha) ----------

  /** Offene Schmerz-Abfrage nach dem Abhaken (Zeile unter der Routine). */
  const painAsk = ref<{ clientId: string; day: string } | null>(null);

  /** Schmerz 0-10 eines Tages speichern (null = entfernen). */
  function setPain(clientId: string, level: number | null, day = today.value) {
    const r = routines.value.find((x) => x.clientId === clientId);
    if (!r || day > today.value) return;
    const pain = setPainLevel(r.pain ?? [], day, level);
    routines.value = routines.value.map((x) => (x.clientId === clientId ? { ...x, pain, updatedAt: new Date().toISOString(), pending: 'put' as const } : x));
    if (painAsk.value?.clientId === clientId) painAsk.value = null;
    persist();
    void pushPending();
  }
  const skipPain = () => { painAsk.value = null; };

  /** Tipp auf den k-ten Durchgang eines Tages (1-basiert); bei einmal täglich = Haken umschalten. */
  function tap(clientId: string, k = 1, day = today.value) {
    const r = byId(clientId);
    if (r) setCount(clientId, tapCount(doneCount(r, day), k), day);
  }

  /** Haken setzen/entfernen (ganzer Tag). */
  function setDone(clientId: string, done: boolean, day = today.value) {
    const r = byId(clientId);
    if (r) setCount(clientId, done ? r.timesPerDay : 0, day);
  }

  // ---------- Detailansicht (Verlauf, Nachtragen) ----------

  const detailId = ref<string | null>(null);
  const openDetail = (clientId: string) => { detailId.value = clientId; };
  const closeDetail = () => { detailId.value = null; };

  // ---------- Durchspielen mit Timer ----------

  const playerId = ref<string | null>(null);
  const openPlayer = (clientId: string) => { playerId.value = clientId; };
  const closePlayer = () => { playerId.value = null; };

  /**
   * Angefangener Durchgang (Player geschlossen oder App beendet): wo es weitergeht. Gilt nur für denselben Tag und
   * denselben Durchgang - danach verfällt er. Lokal gespeichert, damit Schließen nichts verliert.
   */
  const playerKey = () => { const id = source ? app().userId : null; return id ? userKeys(id).routinePlayer : null; };
  const saved = ref<PlayerProgress | null>(null);
  function saveProgress(p: PlayerProgress | null) {
    saved.value = p;
    const k = playerKey();
    if (k) writeJson(k, p);
  }
  /** Gespeicherter Stand für diese Routine, falls er heute zum nächsten offenen Durchgang gehört. */
  function progressFor(clientId: string): PlayerProgress | null {
    const p = saved.value;
    const r = byId(clientId);
    if (!p || !r || p.clientId !== clientId || p.day !== today.value || p.round !== doneCount(r, today.value) + 1) return null;
    return p;
  }

  // ---------- Bibliothek ----------

  const libraryOpen = ref(false);
  const openLibrary = () => { libraryOpen.value = true; };
  const closeLibrary = () => { libraryOpen.value = false; };
  /** Vorlage übernehmen: Bibliothek zu, Editor mit Vorlage auf (Tage und Zeitraum noch anpassbar). */
  function useTemplate(draft: RoutineDraft) {
    libraryOpen.value = false;
    openNew(draft);
  }

  // ---------- Editor ----------

  function openNew(preset?: Partial<RoutineDraft>) {
    editor.value = { open: true, clientId: null, draft: { ...emptyRoutine(today.value), ...preset } };
  }
  function openEdit(clientId: string) {
    const r = byId(clientId);
    if (!r) return;
    editor.value = {
      open: true, clientId,
      draft: { title: r.title, kind: r.kind, days: r.days, startDate: r.startDate, endDate: r.endDate, reason: r.reason, steps: r.steps.map((s) => ({ ...s })), timesPerDay: r.timesPerDay, times: [...r.times] },
    };
  }
  function close() { editor.value = { ...editor.value, open: false }; }

  function save(): boolean {
    const e = editor.value;
    const clean = cleanDraft(e.draft);
    if (!clean.title || !clean.steps.length) return false;
    const r = upsert(e.clientId ?? newRoutineId(), clean, 'user');
    close();
    useUiStore().toast(t(e.clientId ? 'routines.toast.updated' : 'routines.toast.added', { title: r.title }), 'success');
    return true;
  }

  /** Vorzeitig beenden: Ende = gestern (heute nicht mehr fällig); Verlauf bleibt. */
  function finish(clientId: string) {
    const r = byId(clientId);
    if (!r) return;
    const yesterday = localDay(new Date(app().clockDate.getTime() - 86_400_000));
    // Erst heute (oder später) begonnen: Zeitraum auf gestern legen - sonst wäre sie heute noch fällig
    const startDate = r.startDate > yesterday ? yesterday : r.startDate;
    upsert(clientId, { ...r, startDate, endDate: yesterday }, r.source);
    close();
    useUiStore().toast(t('routines.toast.finished', { title: r.title }), 'success');
  }

  async function remove(clientId: string) {
    const r = byId(clientId);
    if (!r) return;
    const ok = await useUiStore().confirm({ title: t('routines.confirm.title'), message: t('routines.confirm.message', { title: r.title }), confirmText: t('common.remove'), danger: true });
    if (!ok) return;
    routines.value = routines.value.map((x) => (x.clientId === clientId ? { ...x, pending: 'delete' as const } : x));
    persist();
    close();
    closeDetail();
    await pushPending();
  }

  function clear() { saved.value = null; painAsk.value = null; libraryOpen.value = false; playerId.value = null; routines.value = []; detailId.value = null; editor.value = { open: false, clientId: null, draft: emptyRoutine(localDay()) }; }

  return {
    connect, routines, editor, today, visible, forToday, progressOf, byId, load, pushPending, applyFromCoach, setCount, tap, setDone, painAsk, setPain, skipPain,
    detailId, openDetail, closeDetail, libraryOpen, openLibrary, closeLibrary, useTemplate, playerId, openPlayer, closePlayer, saved, saveProgress, progressFor, openNew, openEdit, close, save, finish, remove, clear,
  };
});
