// Kraft-Ziele: Zustand, Offline-Speicher und Sync. Die Rechenlogik liegt in lib/goals.ts.
//
// Offline-first wie beim Befinden: Änderungen gehen sofort in den lokalen Speicher (pending) und werden per PUT/DELETE
// nachgereicht - beide Requests sind idempotent, ein Wiederholen nach Funkloch ist also unkritisch.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { t } from '../i18n';
import { isApiError, type Api } from '../lib/api';
import { goalProgress, goalSessions, nextPrescription, reachesGoal, type GoalPrescription, type GoalProgress, type LiftGoal } from '../lib/goals';
import { readJson, userKeys, writeJson } from '../lib/storage';
import { eventLine } from '../lib/motivation';
import { exerciseName } from '../i18n/content';
import { formatNumber } from '../lib/format';
import { epley1RM } from '../lib/analytics';
import type { Exercise, Workout, WorkoutSet } from '../types';
import { useUiStore } from './ui';

/**
 * Was der Ziel-Store vom App-Store braucht. Bewusst als Schnittstelle statt Import von useAppStore:
 * so gibt es keinen Typ-Zirkel (der App-Store nutzt seinerseits die Ziele für die Vorbelegung).
 */
export interface GoalsSource {
  readonly userId: number | null;
  readonly online: boolean;
  readonly allWorkouts: readonly Workout[];
  readonly exercisesById: ReadonlyMap<number, Exercise>;
  readonly clockDate: Date;
  api(): Api;
}

export interface GoalView {
  goal: LiftGoal;
  exercise: Exercise | null;
  progress: GoalProgress;
  next: GoalPrescription;
}

export interface GoalDraft {
  open: boolean;
  exerciseId: number | null;
  targetWeight: number;
  targetReps: number;
  increment: number;
  /** Aktuelles 1RM (geschätzt oder eingegeben) - Startpunkt. */
  startE1RM: number | null;
  targetDate: string;
  editing: boolean;
  busy: boolean;
}

const emptyDraft = (): GoalDraft => ({ open: false, exerciseId: null, targetWeight: 0, targetReps: 1, increment: 2.5, startE1RM: null, targetDate: '', editing: false, busy: false });
const isNetwork = (e: unknown) => isApiError(e) && e.isNetwork;

export const useGoalsStore = defineStore('goals', () => {
  const goals = ref<LiftGoal[]>([]);
  const draft = ref<GoalDraft>(emptyDraft());

  let source: (() => GoalsSource) | null = null;
  /** Einmal vom App-Store aufgerufen. */
  function connect(get: () => GoalsSource) { source = get; }
  const app = (): GoalsSource => {
    if (!source) throw new Error('goals store not connected');
    return source();
  };
  const storageKey = () => { const id = source ? app().userId : null; return id ? userKeys(id).goals : null; };
  const persist = () => { const k = storageKey(); if (k) writeJson(k, goals.value); };

  /** Sichtbare Ziele (lokal gelöschte, noch nicht synchronisierte ausgeblendet). */
  const active = computed(() => goals.value.filter((g) => g.pending !== 'delete'));
  const byExercise = computed(() => new Map(active.value.map((g) => [g.exerciseId, g])));

  const views = computed<GoalView[]>(() => {
    if (!source) return [];
    const store = app();
    return active.value.map((goal) => {
      const sessions = goalSessions(store.allWorkouts, goal.exerciseId);
      return {
        goal,
        exercise: store.exercisesById.get(goal.exerciseId) ?? null,
        progress: goalProgress(goal, sessions, store.clockDate),
        next: nextPrescription(goal, sessions),
      };
    }).sort((a, b) => Number(a.progress.achieved) - Number(b.progress.achieved) || b.progress.percent - a.progress.percent);
  });

  const viewFor = (exerciseId: number): GoalView | null => views.value.find((v) => v.goal.exerciseId === exerciseId) ?? null;

  /** Vorgabe für den Geister-Satz (nur wenn es kein Plan-Ziel gibt). */
  function suggestionFor(exerciseId: number): { weight: number; reps: number } | null {
    const v = viewFor(exerciseId);
    // Testtag nicht vorbelegen: erst aufwärmen, das Zielgewicht trägt man bewusst selbst ein
    if (!v || v.next.kind === 'achieved' || v.next.kind === 'test' || v.next.weight == null) return null;
    return { weight: v.next.weight, reps: v.next.reps };
  }

  async function load() {
    const k = storageKey();
    if (!k) return;
    goals.value = readJson<LiftGoal[]>(k, []);
    if (!app().online) return;
    try {
      await pushPending();
      const fresh = await app().api().get<LiftGoal[]>('/api/goals');
      const pending = goals.value.filter((g) => g.pending);
      goals.value = [...pending, ...fresh.filter((f) => !pending.some((p) => p.exerciseId === f.exerciseId))];
      persist();
    } catch (e) {
      if (!isNetwork(e)) console.warn('[goals] load failed', e);
    }
  }

  async function pushPending() {
    // Ziele auf offline angelegten Übungen warten, bis die Übung eine Server-ID hat (remapExercises)
    for (const g of goals.value.filter((x) => x.pending && x.exerciseId > 0)) {
      try {
        if (g.pending === 'delete') {
          await app().api().del(`/api/goals/${g.exerciseId}`);
          goals.value = goals.value.filter((x) => x !== g);
        } else {
          const { exerciseId, targetWeight, targetReps, increment, startE1RM, targetDate, achievedAt } = g;
          await app().api().put(`/api/goals/${exerciseId}`, { targetWeight, targetReps, increment, startE1RM, targetDate: targetDate || null, achievedAt });
          g.pending = undefined;
        }
      } catch (e) {
        if (isNetwork(e)) break;
        // Vom Server abgelehnt (z. B. Übung gelöscht): lokal verwerfen statt ewig zu wiederholen.
        console.warn('[goals] rejected', e);
        goals.value = goals.value.filter((x) => x !== g);
      }
    }
    persist();
  }

  /** Bestes geschätztes 1RM der letzten Einheiten - Vorschlag für den Startwert. */
  function estimateFor(exerciseId: number): number | null {
    const sessions = goalSessions(app().allWorkouts, exerciseId).slice(-3);
    const best = Math.max(0, ...sessions.flatMap((s) => s.sets.map((x) => epley1RM(x.weight, x.reps))));
    return best > 0 ? Math.round(best * 2) / 2 : null;
  }

  function openGoal(exerciseId: number) {
    const existing = byExercise.value.get(exerciseId);
    const estimate = estimateFor(exerciseId);
    draft.value = existing
      ? { open: true, exerciseId, targetWeight: existing.targetWeight, targetReps: existing.targetReps, increment: existing.increment, startE1RM: existing.startE1RM ?? estimate, targetDate: existing.targetDate ?? '', editing: true, busy: false }
      : { open: true, exerciseId, targetWeight: estimate ? Math.ceil((estimate * 1.1) / 2.5) * 2.5 : 60, targetReps: 1, increment: 2.5, startE1RM: estimate, targetDate: '', editing: false, busy: false };
  }

  /** Neues Ziel ohne Übung - die Übung wird im Dialog gewählt. */
  function openNewGoal() { draft.value = { ...emptyDraft(), open: true }; }

  function closeGoal() { draft.value = { ...draft.value, open: false }; }

  async function saveGoal() {
    const d = draft.value;
    if (d.exerciseId == null || !(d.targetWeight > 0)) return;
    const existing = byExercise.value.get(d.exerciseId);
    const now = new Date().toISOString();
    const goal: LiftGoal = {
      exerciseId: d.exerciseId,
      targetWeight: Math.min(1000, Math.round(d.targetWeight * 100) / 100),
      targetReps: Math.max(1, Math.min(12, Math.round(d.targetReps))),
      increment: Math.max(0.25, Math.min(20, d.increment)),
      startE1RM: d.startE1RM && d.startE1RM > 0 ? Math.round(d.startE1RM * 10) / 10 : null,
      targetDate: d.targetDate || null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      // Ziel geändert -> wieder offen
      achievedAt: existing && existing.targetWeight === d.targetWeight && existing.targetReps === d.targetReps ? existing.achievedAt : null,
      pending: 'put',
    };
    goals.value = [goal, ...goals.value.filter((g) => g.exerciseId !== goal.exerciseId)];
    persist();
    closeGoal();
    useUiStore().toast(t(existing ? 'goals.toast.updated' : 'goals.toast.created'), 'success');
    await pushPending();
  }

  async function removeGoal(exerciseId: number) {
    const ok = await useUiStore().confirm({ title: t('goals.confirm.title'), message: t('goals.confirm.message'), confirmText: t('common.remove'), danger: true });
    if (!ok) return;
    goals.value = goals.value.map((g) => (g.exerciseId === exerciseId ? { ...g, pending: 'delete' as const } : g));
    persist();
    closeGoal();
    await pushPending();
  }

  /** Nach jedem geloggten Satz: Ziel erreicht? -> feiern und markieren. */
  async function checkAchieved(set: WorkoutSet & { exerciseId: number }) {
    const g = byExercise.value.get(set.exerciseId);
    if (!g || g.achievedAt || !reachesGoal(set, g)) return;
    g.achievedAt = new Date().toISOString();
    g.pending = 'put';
    persist();
    const ex = app().exercisesById.get(g.exerciseId);
    const line = eventLine('goalReached', { exercise: exerciseName(ex ?? g.exerciseId), weight: formatNumber(g.targetWeight, 2) });
    useUiStore().toast(line || t('goals.toast.achieved', { weight: g.targetWeight, reps: g.targetReps }), 'gold');
    await pushPending();
  }

  /** Offline angelegte Übung hat ihre Server-ID bekommen. */
  function remapExercises(m: ReadonlyMap<number, number>) {
    if (!goals.value.some((g) => m.has(g.exerciseId))) return;
    goals.value = goals.value.map((g) => (m.has(g.exerciseId) ? { ...g, exerciseId: m.get(g.exerciseId)!, pending: g.pending ?? 'put' } : g));
    persist();
    void pushPending();
  }

  function clear() { goals.value = []; draft.value = emptyDraft(); }

  return { connect, goals, draft, active, byExercise, views, viewFor, suggestionFor, estimateFor, load, pushPending, remapExercises, openGoal, openNewGoal, closeGoal, saveGoal, removeGoal, checkAchieved, clear };
});
