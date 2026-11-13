// Routinen (Dehnen, Reha, Prävention): Zustand, Offline-Speicher und Sync. Rechenlogik in lib/routines.ts.
//
// Offline-first wie bei den Zielen: jede Änderung (auch der Erledigt-Haken) landet sofort lokal (pending) und wird per
// PUT/DELETE nachgereicht. Beide Requests sind idempotent (Client-Id), ein Wiederholen nach Funkloch ist also unkritisch.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { t } from '../i18n';
import { isApiError, type Api } from '../lib/api';
import { readJson, userKeys, writeJson } from '../lib/storage';
import { localDay } from '../lib/wellness';
import { EVERY_DAY, newRoutineId, routineProgress, sortRoutines, todaysRoutines, toggleDone, type Routine, type RoutineKind, type RoutineStep } from '../lib/routines';
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
}

export interface RoutineEditor {
  open: boolean;
  /** Bearbeitete Routine; null = neu. */
  clientId: string | null;
  draft: RoutineDraft;
}

const isNetwork = (e: unknown) => isApiError(e) && e.isNetwork;

export const emptyRoutine = (today: string): RoutineDraft => ({
  title: '', kind: 'mobility', days: EVERY_DAY, startDate: today, endDate: null, reason: null, steps: [{ name: '', dose: '' }],
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
  };
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

  async function load() {
    const k = key();
    if (!k) return;
    routines.value = readJson<Routine[]>(k, []);
    if (!app().online) return;
    try {
      await pushPending();
      const fresh = await app().api().get<Routine[]>('/api/routines');
      const pending = routines.value.filter((r) => r.pending);
      routines.value = [...pending, ...fresh.filter((f) => !pending.some((p) => p.clientId === f.clientId))];
      persist();
    } catch (e) {
      if (!isNetwork(e)) console.warn('[routines] load failed', e);
    }
  }

  let pushing: Promise<void> | null = null;
  let current: object | null = null;
  /** Ausstehende Änderungen senden - nie parallel (schnelles Abhaken soll nicht doppelt senden). */
  function pushPending(): Promise<void> {
    if (pushing) return pushing;
    const token = {};
    current = token;
    const run = (async () => {
      await Promise.resolve(); // erst nach der Zuweisung unten starten (sonst setzt finally "pushing" zu früh zurück)
      try {
        for (const r of routines.value.filter((x) => x.pending)) {
          const sent = r.updatedAt;
          try {
            if (r.pending === 'delete') {
              await app().api().del(`/api/routines/${r.clientId}`);
              routines.value = routines.value.filter((x) => x.clientId !== r.clientId || x.pending !== 'delete');
            } else {
              const { title, kind, days, startDate, endDate, reason, steps, doneDates, source: by } = r;
              await app().api().put(`/api/routines/${r.clientId}`, { title, kind, days, startDate, endDate, reason, steps, doneDates, source: by });
              // Inzwischen erneut geändert (Haken während des Sendens)? Dann bleibt sie ausstehend
              const now = routines.value.find((x) => x.clientId === r.clientId);
              if (now && now.updatedAt === sent) now.pending = undefined;
            }
          } catch (e) {
            if (isNetwork(e)) break;
            // Vom Server abgelehnt: lokal behalten wäre ewiges Wiederholen - verwerfen und melden
            console.warn('[routines] rejected', e);
            routines.value = routines.value.filter((x) => x.clientId !== r.clientId);
            useUiStore().toast(t('routines.toast.rejected', { title: r.title }), 'error');
          }
        }
        persist();
      } finally {
        if (current === token) pushing = null;
      }
    })();
    pushing = run;
    return run;
  }

  function upsert(clientId: string, draft: RoutineDraft, by: Routine['source'], keepDone = true): Routine {
    const existing = routines.value.find((r) => r.clientId === clientId);
    const now = new Date().toISOString();
    const clean = cleanDraft(draft);
    const routine: Routine = {
      ...clean,
      clientId,
      source: existing?.source ?? by,
      doneDates: keepDone ? existing?.doneDates ?? [] : [],
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

  function setDone(clientId: string, done: boolean, day = today.value) {
    const r = routines.value.find((x) => x.clientId === clientId);
    if (!r || r.doneDates.includes(day) === done) return;
    r.doneDates = toggleDone(r.doneDates, day);
    r.updatedAt = new Date().toISOString();
    r.pending = 'put';
    persist();
    void pushPending();
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
      draft: { title: r.title, kind: r.kind, days: r.days, startDate: r.startDate, endDate: r.endDate, reason: r.reason, steps: r.steps.map((s) => ({ ...s })) },
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
    await pushPending();
  }

  function clear() { routines.value = []; editor.value = { open: false, clientId: null, draft: emptyRoutine(localDay()) }; }

  return { connect, routines, editor, today, visible, forToday, progressOf, byId, load, pushPending, applyFromCoach, setDone, openNew, openEdit, close, save, finish, remove, clear };
});
