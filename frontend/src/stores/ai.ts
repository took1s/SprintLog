// KI-Coach (Claude über den eigenen Server): Chat mit dem Coach und Trainingspläne von der KI.
//
// - Der API-Key liegt nur auf dem Server. Ohne Key meldet /api/ai/status enabled=false und die App zeigt keine KI-Knöpfe.
// - Mitgeschickt wird eine kompakte Zusammenfassung der eigenen Daten (lib/aiContext.ts), keine Rohdaten.
// - Der Verlauf bleibt lokal auf dem Gerät (pro Konto) und wird beim Abmelden gelöscht.

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { locale, t, tDynamic } from '../i18n';
import { exerciseName } from '../i18n/content';
import { isApiError } from '../lib/api';
import { buildAiContext } from '../lib/aiContext';
import type { Reason } from '../lib/coach';
import { scheduleFor, type PlanAnswers } from '../lib/planBuilder';
import { WEEKDAYS, kindOf, hasSchedule } from '../lib/schedule';
import { readJson, userKeys, writeJson } from '../lib/storage';
import type { TrainingProgram } from '../types';
import { useAppStore } from './app';
import { useGoalsStore } from './goals';
import { useUiStore } from './ui';

export interface AiChatMessage { role: 'user' | 'assistant'; content: string; at: string }
export interface AiStatus { enabled: boolean; remaining: number; dailyLimit: number }
export interface AiProgramDraft {
  name: string;
  goal: string;
  weeks: number;
  days: { name: string; notes?: string | null; exercises: { exerciseId: number; sets: number; repsMin?: number | null; repsMax?: number | null; distance?: number | null; time?: number | null; targetRpe?: number | null; restSeconds?: number | null; note?: string | null }[] }[];
}
export type AiErrorCode = 'ai_disabled' | 'ai_quota' | 'ai_no_credit' | 'ai_key_invalid' | 'ai_busy' | 'ai_unavailable' | 'ai_bad_plan' | 'ai_empty' | 'offline' | 'unknown';

const MAX_STORED = 40;
/** Wie viele frühere Nachrichten als Gesprächsverlauf mitgehen (Kosten vs. Zusammenhang). */
const HISTORY = 8;
const CODES: readonly AiErrorCode[] = ['ai_disabled', 'ai_quota', 'ai_no_credit', 'ai_key_invalid', 'ai_busy', 'ai_unavailable', 'ai_bad_plan', 'ai_empty'];

function errorCode(e: unknown): AiErrorCode {
  if (!isApiError(e)) return 'unknown';
  if (e.isNetwork) return 'offline';
  if (e.status === 429) return 'ai_quota';
  return CODES.find((c) => e.message.startsWith(c)) ?? 'unknown';
}

/** Coach-Gründe als kurzer englischer Text für die Zusammenfassung. */
function reasonText(r: Reason): string {
  switch (r.key) {
    case 'readinessLow': case 'readinessGood': return `${r.key} ${r.value}%`;
    case 'notRecovered': return `${r.region} only ${r.percent}% recovered`;
    case 'longBreak': return `${r.days} days without training`;
    case 'planNext': return `next plan day ${r.day}`;
    default: return r.key;
  }
}

export const useAiStore = defineStore('ai', () => {
  const app = useAppStore();
  const status = ref<AiStatus | null>(null);
  const open = ref(false);
  const messages = ref<AiChatMessage[]>([]);
  const busy = ref(false);
  const error = ref<AiErrorCode | null>(null);

  const plan = ref<{ busy: boolean; error: AiErrorCode | null; notes: string; result: { program: AiProgramDraft; summary: string; answers: PlanAnswers } | null; saving: boolean }>(
    { busy: false, error: null, notes: '', result: null, saving: false });

  const enabled = computed(() => !!status.value?.enabled);
  const storageKey = computed(() => (app.user?.userId ? userKeys(app.user.userId).aiChat : null));

  // Konto gewechselt / abgemeldet: Verlauf des richtigen Kontos laden
  watch(storageKey, (k) => {
    messages.value = k ? readJson<AiChatMessage[]>(k, []) : [];
    status.value = null;
    plan.value = { busy: false, error: null, notes: '', result: null, saving: false };
  }, { immediate: true });
  const persist = () => { if (storageKey.value) writeJson(storageKey.value, messages.value.slice(-MAX_STORED)); };

  async function loadStatus() {
    if (!app.isAuthenticated || !app.online) return;
    try { status.value = await app.api().get<AiStatus>('/api/ai/status'); } catch { /* KI bleibt ausgeblendet */ }
  }

  /** Zusammenfassung der eigenen Daten zum Zeitpunkt der Frage. */
  function context(): string {
    const p = app.activeProgram;
    const info = app.programInfo;
    const goals = useGoalsStore();
    return buildAiContext({
      now: app.clockDate,
      program: p ? {
        name: p.name, goal: String(p.goal), week: info?.week ?? 1, weeks: p.weeks, nextDay: info?.next?.name ?? null,
        days: [...p.days].sort((a, b) => a.position - b.position).map((d) => ({
          name: d.name,
          exercises: d.exercises.map((x) => `${app.exercisesById.get(x.exerciseId)?.name ?? x.exerciseName ?? `#${x.exerciseId}`} ${x.sets}x${x.repsMin ? `${x.repsMin}${x.repsMax && x.repsMax !== x.repsMin ? `-${x.repsMax}` : ''}` : x.distance ? `${x.distance}m` : x.time ? `${x.time}s` : ''}`),
        })),
      } : null,
      schedule: p && hasSchedule(p) ? { training: WEEKDAYS.filter((d) => kindOf(p, d) === 'training'), match: WEEKDAYS.filter((d) => kindOf(p, d) === 'match') } : null,
      coach: { kind: app.coach.kind, reasons: app.coach.reasons.map(reasonText) },
      recovery: app.recovery.map((r) => ({ region: r.region, percent: r.percent, readyAt: r.readyAt })),
      load: { zone: app.loadInfo.zone, ratio: app.loadInfo.ratio, acute: app.loadInfo.acute, chronic: app.loadInfo.chronic },
      readiness: app.readinessToday,
      wellness: app.wellness,
      workouts: app.allWorkouts,
      exerciseName: (s) => (s.exerciseId != null ? app.exercisesById.get(s.exerciseId)?.name : null) ?? s.exerciseName ?? s.name ?? 'Exercise',
      goals: goals.views.map((v) => ({
        exercise: v.exercise?.name ?? exerciseName(v.goal.exerciseId),
        target: `${v.goal.targetWeight} kg x${v.goal.targetReps}`,
        percent: Math.round(v.progress.percent),
        achieved: v.progress.achieved,
      })),
    });
  }

  function openChat() {
    open.value = true;
    // Unbeantwortete letzte Frage (Fehler, App zwischendurch geschlossen): Hinweis + "Erneut versuchen" behalten
    const unanswered = messages.value[messages.value.length - 1]?.role === 'user';
    if (!unanswered) error.value = null;
    else if (!busy.value && !error.value) error.value = 'unknown';
    void loadStatus();
  }

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 2 || busy.value) return;
    if (!app.online) { error.value = 'offline'; return; }
    const history = messages.value.slice(-HISTORY).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    messages.value = [...messages.value, { role: 'user', content: q, at: new Date().toISOString() }];
    persist();
    busy.value = true;
    error.value = null;
    try {
      const res = await app.api().post<{ answer: string; remaining: number }>('/api/ai/ask', { question: q, context: context(), history, locale: locale.value });
      messages.value = [...messages.value, { role: 'assistant', content: res.answer, at: new Date().toISOString() }];
      if (status.value) status.value = { ...status.value, remaining: res.remaining };
      persist();
    } catch (e) {
      error.value = errorCode(e);
      if (error.value === 'ai_quota' && status.value) status.value = { ...status.value, remaining: 0 };
    } finally {
      busy.value = false;
    }
  }

  /** Letzte Frage nach einem Fehler erneut senden (ohne sie doppelt in den Verlauf zu schreiben). */
  async function retry() {
    const last = messages.value[messages.value.length - 1];
    if (!last || last.role !== 'user') return;
    messages.value = messages.value.slice(0, -1);
    await ask(last.content);
  }

  async function clearChat() {
    const ok = await useUiStore().confirm({ title: t('ai.clear.title'), message: t('ai.clear.message'), confirmText: t('ai.clear.confirm'), danger: true });
    if (!ok) return;
    messages.value = [];
    error.value = null;
    persist();
  }

  // ---------- Plan von der KI ----------

  async function generatePlan(answers: PlanAnswers) {
    const pl = plan.value;
    if (pl.busy) return;
    if (!app.online) { pl.error = 'offline'; return; }
    pl.busy = true;
    pl.error = null;
    pl.result = null;
    try {
      const res = await app.api().post<{ program: AiProgramDraft; summary: string; remaining: number }>('/api/ai/plan', {
        answers: { ...answers }, notes: pl.notes.trim() || null, context: context(), locale: locale.value,
      });
      pl.result = { program: res.program, summary: res.summary, answers: { ...answers } };
      if (status.value) status.value = { ...status.value, remaining: res.remaining };
    } catch (e) {
      pl.error = errorCode(e);
    } finally {
      pl.busy = false;
    }
  }

  function discardPlan() { plan.value = { ...plan.value, result: null, error: null }; }

  /** Vorschlag übernehmen: als eigenes Programm speichern, aktivieren und den Wochenplan setzen. */
  async function acceptPlan(): Promise<boolean> {
    const pl = plan.value;
    if (!pl.result || pl.saving) return false;
    const ui = useUiStore();
    if (app.activeProgram) {
      const ok = await ui.confirm({ title: t('plan.confirm.switchTitle'), message: t('plan.confirm.switchMessage', { name: app.activeProgram.name }), confirmText: t('common.start') });
      if (!ok) return false;
    }
    pl.saving = true;
    try {
      const created = await app.api().post<TrainingProgram>('/api/programs', pl.result.program);
      if (!created.isActive) await app.api().post(`/api/programs/${created.id}/activate`);
      await app.loadPrograms();
      const active = app.activeProgram;
      if (active?.id === created.id) await app.setSchedule(active, scheduleFor(pl.result.answers));
      ui.toast(t('plan.toast.started', { name: created.name }), 'success');
      plan.value = { busy: false, error: null, notes: '', result: null, saving: false };
      app.planBuilder.open = false;
      return true;
    } catch (e) {
      ui.toast(isApiError(e) && e.isNetwork ? t('plan.toast.needsConnection') : tDynamic('ai.errors.unknown', 'Error'), 'error');
      return false;
    } finally {
      pl.saving = false;
    }
  }

  return { status, enabled, open, messages, busy, error, plan, loadStatus, openChat, ask, retry, clearChat, generatePlan, discardPlan, acceptPlan, context };
});
