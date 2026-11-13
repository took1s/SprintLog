// KI-Coach (Claude über den eigenen Server): Chat (schnell/gründlich) mit Vorschlags-Karten, Pläne, Analyse, Sportler-Profil.
//
// - Der API-Key liegt nur auf dem Server. Ohne Key meldet /api/ai/status enabled=false und die App zeigt keine KI-Knöpfe.
// - Mitgeschickt werden Profil + eine kompakte Zusammenfassung (lib/aiContext.ts); exakte Statistiken holt sich die KI
//   über Werkzeuge vom Server.
// - Vorschläge (Plan, Ziel, Wochenplan) werden nie automatisch gespeichert - nur nach Bestätigung auf der Karte.
// - Verlauf, Analyse und Profil-Kopie bleiben lokal pro Konto und werden beim Abmelden gelöscht.
// - Gedächtnis: der Coach merkt sich Wichtiges im Konto (Server); hier eine Kopie zum Ansehen und Verwalten.

import { defineStore } from 'pinia';
import type { WorkoutOp } from '@/lib/liveWorkout';
import { computed, ref, watch } from 'vue';
import { locale, t } from '../i18n';
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

export type AiMode = 'quick' | 'deep';
export interface AiStatus { enabled: boolean; remaining: number; dailyLimit: number; costs?: Partial<Record<'quick' | 'deep' | 'plan' | 'analysis', number>> }
export interface AiProgramDraft {
  name: string;
  goal: string;
  weeks: number;
  days: { name: string; notes?: string | null; exercises: { exerciseId: number; sets: number; repsMin?: number | null; repsMax?: number | null; distance?: number | null; time?: number | null; targetRpe?: number | null; restSeconds?: number | null; note?: string | null }[] }[];
}
export interface AiProgramUpdateDraft extends AiProgramDraft {
  days: (AiProgramDraft['days'][number] & { id?: number | null })[];
  cycleWeeks?: number | null;
  deloadEvery?: number | null;
}
export type AiAction =
  | { type: 'program'; program: AiProgramDraft; summary: string }
  | { type: 'programUpdate'; programId: number; programName: string; program: AiProgramUpdateDraft; changes: string[] }
  | { type: 'goal'; exerciseId: number; exerciseName: string; targetWeight: number; targetReps: number; targetDate: string | null; reason: string }
  | { type: 'schedule'; trainingDays: number; matchDays: number; reason: string }
  /** Änderung an der laufenden Einheit (nur im Training) - wird lokal angewendet, nichts geht an den Server. */
  | { type: 'workout'; operations: WorkoutOp[]; changes: string[] };
export type MemoryCategory = 'injury' | 'health' | 'goal' | 'schedule' | 'preference' | 'equipment' | 'insight' | 'other';
export const MEMORY_CATEGORIES: readonly MemoryCategory[] = ['injury', 'health', 'goal', 'schedule', 'preference', 'equipment', 'insight', 'other'];
export interface CoachMemory {
  id: number; category: MemoryCategory; content: string; importance: 1 | 2 | 3; source: 'ai' | 'user';
  createdAt: string; updatedAt: string; expiresAt: string | null;
}
/** Was der Coach in einer Antwort an seinem Gedächtnis geändert hat (Hinweis unter der Antwort). */
export interface MemoryChange { action: 'saved' | 'updated' | 'forgotten'; id: number; category: MemoryCategory; content: string; undone?: boolean }
export interface AiChatMessage { role: 'user' | 'assistant'; content: string; at: string; mode?: AiMode; actions?: AiAction[]; applied?: number[]; memory?: MemoryChange[]; /** Nur Fragen: gleiche Id beim Wiederholen. */ requestId?: string }

export interface AiReportSection { area?: string; title: string; status: 'good' | 'watch' | 'risk'; points: string[] }
export interface AiReport { headline: string; summary: string; sections: AiReportSection[]; recommendations: { title: string; why: string; action: string }[]; nextWeekFocus: string }
export interface AiAnalysis { report: AiReport; generatedAt: string; period: 'full' | 'week' }

export interface AthleteProfile {
  position: string | null; birthYear: number | null; heightCm: number | null; weightKg: number | null; level: string | null;
  goals: string | null; injuries: string | null; equipment: string | null; sessionMinutes: number | null; notes: string | null;
  updatedAt?: string | null;
  /** Nur lokal: Änderung noch nicht beim Server. */
  pending?: boolean;
}
export const emptyProfile = (): AthleteProfile => ({ position: null, birthYear: null, heightCm: null, weightKg: null, level: null, goals: null, injuries: null, equipment: null, sessionMinutes: null, notes: null });
export const POSITIONS = ['goalkeeper', 'defender', 'fullback', 'midfielder', 'winger', 'striker'] as const;

export type AiErrorCode = 'ai_disabled' | 'ai_quota' | 'ai_rate' | 'ai_no_credit' | 'ai_key_invalid' | 'ai_model' | 'ai_busy' | 'ai_unavailable' | 'ai_bad_plan' | 'ai_empty' | 'ai_timeout' | 'offline' | 'unknown';

const MAX_STORED = 40;
/** Wie viele frühere Nachrichten als Gesprächsverlauf mitgehen (Kosten vs. Zusammenhang). */
const HISTORY = 8;
const CODES: readonly AiErrorCode[] = ['ai_disabled', 'ai_quota', 'ai_no_credit', 'ai_key_invalid', 'ai_model', 'ai_busy', 'ai_unavailable', 'ai_bad_plan', 'ai_empty', 'ai_timeout'];
const DEFAULT_COSTS = { quick: 1, deep: 4, plan: 6, analysis: 6 } as const;
const MODE_KEY = 'sprintlog:aiMode';

function errorCode(e: unknown): AiErrorCode {
  if (!isApiError(e)) return 'unknown';
  if (e.isNetwork) return 'offline';
  const code = CODES.find((c) => e.message.startsWith(c));
  if (code) return code;
  // 429 ohne Code: allgemeines Rate-Limit (zu viele Anfragen pro Minute), nicht das Tageskontingent
  return e.status === 429 ? 'ai_rate' : 'unknown';
}

// Standard: gründlich (Profi-Qualität); wer bewusst "Schnell" wählt, behält das auf diesem Gerät
const readMode = (): AiMode => { try { return localStorage.getItem(MODE_KEY) === 'quick' ? 'quick' : 'deep'; } catch { return 'deep'; } };

/** Pausen vor automatischen Wiederholungen nach einem Netzwerkfehler (z. B. eingeschlafene Verbindung nach dem Aufwachen). */
/** Id je KI-Anfrage (Wiederholungen nach Netzabbruch kosten so nichts extra). */
const newRequestId = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, '');
const RETRY_DELAYS = [1200, 3500];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Hat das Gerät überhaupt Netz? Bewusst NICHT der Sync-Status der App (app.online): der springt nach einem einzelnen
 * fehlgeschlagenen Hintergrund-Sync auf "offline" und blieb dann hängen - der Chat meldete "Kein Internet", obwohl es ging.
 */
export const deviceOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { deviceOnline.value = true; });
  window.addEventListener('offline', () => { deviceOnline.value = false; });
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
  const mode = ref<AiMode>(readMode());
  watch(mode, (m) => { try { localStorage.setItem(MODE_KEY, m); } catch { /* privat */ } });
  /** Aktion auf einer Karte läuft gerade ("<Nachricht>:<Karte>"). */
  const applying = ref<string | null>(null);

  const analysis = ref<AiAnalysis | null>(null);
  const analysisBusy = ref<'full' | 'week' | null>(null);
  const analysisError = ref<AiErrorCode | null>(null);

  const profile = ref<AthleteProfile>(emptyProfile());
  const profileOpen = ref(false);
  const profileBusy = ref(false);
  /** Profil hat mindestens ein Feld - sonst weist der Chat freundlich darauf hin. */
  const profileFilled = computed(() => Object.entries(profile.value).some(([k, v]) => !['updatedAt', 'pending'].includes(k) && v != null && v !== ''));

  const memory = ref<CoachMemory[]>([]);
  const memoryOpen = ref(false);
  const memoryLoading = ref(false);

  const plan = ref<{ busy: boolean; error: AiErrorCode | null; notes: string; result: { program: AiProgramDraft; summary: string; answers: PlanAnswers } | null; saving: boolean }>(
    { busy: false, error: null, notes: '', result: null, saving: false });

  const enabled = computed(() => !!status.value?.enabled);
  const keys = computed(() => (app.user?.userId ? userKeys(app.user.userId) : null));
  const storageKey = computed(() => keys.value?.aiChat ?? null);
  const cost = (k: keyof typeof DEFAULT_COSTS) => status.value?.costs?.[k] ?? DEFAULT_COSTS[k];
  /** Wie viele Anfragen der Art heute noch gehen. */
  const left = (k: keyof typeof DEFAULT_COSTS) => (status.value ? Math.floor(status.value.remaining / cost(k)) : 0);

  // Konto gewechselt / abgemeldet: Daten des richtigen Kontos laden
  watch(keys, (k) => {
    messages.value = k ? readJson<AiChatMessage[]>(k.aiChat, []) : [];
    analysis.value = k ? readJson<AiAnalysis | null>(k.aiAnalysis, null) : null;
    profile.value = k ? { ...emptyProfile(), ...readJson<Partial<AthleteProfile>>(k.athlete, {}) } : emptyProfile();
    memory.value = k ? readJson<CoachMemory[]>(k.aiMemory, []) : [];
    memoryOpen.value = false;
    status.value = null;
    plan.value = { busy: false, error: null, notes: '', result: null, saving: false };
  }, { immediate: true });
  const persist = () => { if (storageKey.value) writeJson(storageKey.value, messages.value.slice(-MAX_STORED)); };
  const setRemaining = (n: number) => { if (status.value) status.value = { ...status.value, remaining: n }; };

  /**
   * KI-Anfrage mit automatischer Wiederholung bei Netzwerkfehlern. Doppelte Ausführung ist unkritisch (keine Daten werden
   * geändert, höchstens eine Einheit des Tageskontingents). Erfolg setzt den Sync-Status wieder auf online.
   */
  async function aiPost<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await app.api().post<T>(path, body);
        app.online = navigator.onLine !== false; // wie markOnline(): echter Netzverlust hat Vorrang
        return res;
      } catch (e) {
        if (!(isApiError(e) && e.isNetwork) || attempt >= RETRY_DELAYS.length || !deviceOnline.value) throw e;
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
  }

  async function loadStatus() {
    if (!app.isAuthenticated || !deviceOnline.value) return;
    try { status.value = await app.api().get<AiStatus>('/api/ai/status'); } catch { /* KI bleibt ausgeblendet */ }
    if (status.value?.enabled) { void loadProfile(); void loadMemory(); }
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

  /**
   * @param requestId gleiche Id = gleiche Frage: nach Netzabbruch oder geschlossener App liefert der Server die schon
   * bezahlte Antwort erneut aus, statt ein zweites Mal abzubuchen.
   */
  async function ask(question: string, requestId: string = newRequestId()) {
    const q = question.trim();
    if (q.length < 2 || busy.value) return;
    if (!deviceOnline.value) { error.value = 'offline'; return; }
    const history = messages.value.slice(-HISTORY).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    const m = mode.value;
    messages.value = [...messages.value, { role: 'user', content: q, at: new Date().toISOString(), mode: m, requestId }];
    persist();
    busy.value = true;
    error.value = null;
    try {
      // Im Training sieht der Coach die laufende Einheit und darf sie (per Karte) ändern
      const session = app.isEditing ? null : app.liveSessionForAi();
      const res = await aiPost<{ answer: string; remaining: number; actions?: AiAction[]; memory?: MemoryChange[] }>('/api/ai/ask', {
        question: q, context: context(), history, locale: locale.value, mode: m, requestId, ...(session ? { session } : {}),
      });
      messages.value = [...messages.value, {
        role: 'assistant', content: res.answer, at: new Date().toISOString(), mode: m,
        actions: res.actions?.length ? res.actions : undefined, memory: res.memory?.length ? res.memory : undefined,
      }];
      setRemaining(res.remaining);
      persist();
      // Gedächtnis geändert: Liste frisch holen (Reihenfolge, Zeitstempel kommen vom Server)
      if (res.memory?.length) void loadMemory();
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
    if (last.mode) mode.value = last.mode;
    await ask(last.content, last.requestId ?? newRequestId());
  }

  /** Chat öffnen und direkt eine Frage stellen (z. B. "Mit dem Coach besprechen" aus der Analyse). */
  async function askFromElsewhere(question: string, m: AiMode = 'deep') {
    openChat();
    mode.value = m;
    await ask(question);
  }

  // ---------- Vorschlags-Karten ----------

  /** Programm speichern, aktivieren und optional den Wochenplan setzen (Plan-Builder und Chat-Karten). */
  async function saveProgramDraft(draft: AiProgramDraft, schedule: { trainingDays: number; matchDays: number } | null): Promise<boolean> {
    const ui = useUiStore();
    if (!deviceOnline.value) { ui.toast(t('plan.toast.needsConnection'), 'error'); return false; }
    if (app.activeProgram) {
      const ok = await ui.confirm({ title: t('plan.confirm.switchTitle'), message: t('plan.confirm.switchMessage', { name: app.activeProgram.name }), confirmText: t('common.start') });
      if (!ok) return false;
    }
    try {
      const created = await app.api().post<TrainingProgram>('/api/programs', draft);
      if (!created.isActive) await app.api().post(`/api/programs/${created.id}/activate`);
      await app.loadPrograms();
      const active = app.activeProgram;
      if (schedule && active?.id === created.id) await app.setSchedule(active, schedule);
      ui.toast(t('plan.toast.started', { name: created.name }), 'success');
      return true;
    } catch (e) {
      ui.toast(isApiError(e) && e.isNetwork ? t('plan.toast.needsConnection') : t('ai.errors.unknown'), 'error');
      return false;
    }
  }

  /** Geänderte Version eines bestehenden Programms speichern (Tage mit ID behalten ihren Verlauf). */
  async function applyProgramUpdate(action: Extract<AiAction, { type: 'programUpdate' }>): Promise<boolean> {
    const ui = useUiStore();
    if (!deviceOnline.value) { ui.toast(t('plan.toast.needsConnection'), 'error'); return false; }
    if (!app.programs.some((p) => p.id === action.programId)) { ui.toast(t('ai.actions.programGone'), 'error'); return false; }
    try {
      await app.api().put(`/api/programs/${action.programId}`, action.program);
      await app.loadPrograms();
      ui.toast(t('ai.actions.updateSaved', { name: action.program.name }), 'success');
      return true;
    } catch (e) {
      ui.toast(isApiError(e) && e.isNetwork ? t('plan.toast.needsConnection') : isApiError(e) ? e.message : t('ai.errors.unknown'), 'error');
      return false;
    }
  }

  /** Karte aus dem Chat übernehmen. Erst hier wird gespeichert - die KI selbst ändert nichts. */
  async function applyAction(messageIndex: number, actionIndex: number) {
    const msg = messages.value[messageIndex];
    const action = msg?.actions?.[actionIndex];
    const key = `${messageIndex}:${actionIndex}`;
    if (!msg || !action || applying.value || msg.applied?.includes(actionIndex)) return;
    const ui = useUiStore();
    applying.value = key;
    try {
      let ok = false;
      if (action.type === 'programUpdate') {
        ok = await applyProgramUpdate(action);
      } else if (action.type === 'program') {
        // Steht im Wochenplan schon etwas, bleibt er; sonst Vorschlag aus der Anzahl der Tage
        ok = await saveProgramDraft(action.program, null);
      } else if (action.type === 'workout') {
        ok = app.applyWorkoutChange(action.operations);
      } else if (action.type === 'goal') {
        const goals = useGoalsStore();
        goals.draft = {
          open: false, exerciseId: action.exerciseId, targetWeight: action.targetWeight, targetReps: action.targetReps, increment: 2.5,
          startE1RM: goals.estimateFor(action.exerciseId), targetDate: action.targetDate ?? '', editing: !!goals.byExercise.get(action.exerciseId), busy: false,
        };
        await goals.saveGoal();
        ok = true;
      } else {
        const active = app.activeProgram;
        if (!active) { ui.toast(t('ai.actions.noProgram'), 'error'); return; }
        await app.setSchedule(active, { trainingDays: action.trainingDays, matchDays: action.matchDays });
        ui.toast(t('ai.actions.scheduleSaved'), 'success');
        ok = true;
      }
      if (ok) {
        messages.value = messages.value.map((m, i) => (i === messageIndex ? { ...m, applied: [...(m.applied ?? []), actionIndex] } : m));
        persist();
      }
    } finally {
      applying.value = null;
    }
  }

  // ---------- Analyse ----------

  async function runAnalysis(period: 'full' | 'week') {
    if (analysisBusy.value) return;
    if (!deviceOnline.value) { analysisError.value = 'offline'; return; }
    analysisBusy.value = period;
    analysisError.value = null;
    try {
      const res = await aiPost<{ report: AiReport; generatedAt: string; remaining: number }>('/api/ai/analysis', { context: context(), locale: locale.value, period, requestId: newRequestId() });
      analysis.value = { report: res.report, generatedAt: res.generatedAt, period };
      if (keys.value) writeJson(keys.value.aiAnalysis, analysis.value);
      setRemaining(res.remaining);
    } catch (e) {
      analysisError.value = errorCode(e);
    } finally {
      analysisBusy.value = null;
    }
  }

  // ---------- Sportler-Profil (offline-first wie die Ziele) ----------

  const persistProfile = () => { if (keys.value) writeJson(keys.value.athlete, profile.value); };

  async function pushProfile(): Promise<boolean> {
    if (!profile.value.pending || !deviceOnline.value) return false;
    const { pending: _pending, updatedAt: _updated, ...body } = profile.value;
    try {
      const saved = await app.api().put<AthleteProfile>('/api/profile/athlete', body);
      profile.value = { ...emptyProfile(), ...saved, pending: false };
      persistProfile();
      return true;
    } catch (e) {
      if (isApiError(e) && !e.isNetwork && !e.isRetryable) {
        // Vom Server abgelehnt: lokale Änderung verwerfen statt ewig zu wiederholen
        profile.value = { ...profile.value, pending: false };
        persistProfile();
        throw e;
      }
      return false;
    }
  }

  async function loadProfile() {
    if (!app.isAuthenticated || !deviceOnline.value) return;
    try {
      if (profile.value.pending) { await pushProfile(); return; }
      const fresh = await app.api().get<AthleteProfile>('/api/profile/athlete');
      profile.value = { ...emptyProfile(), ...fresh };
      persistProfile();
    } catch { /* offline: lokale Kopie bleibt */ }
  }

  function openProfile() { profileOpen.value = true; }

  // ---------- Gedächtnis des Coachs ----------

  const persistMemory = () => { if (keys.value) writeJson(keys.value.aiMemory, memory.value); };

  async function loadMemory() {
    if (!app.isAuthenticated || !deviceOnline.value) return;
    memoryLoading.value = true;
    try {
      memory.value = await app.api().get<CoachMemory[]>('/api/ai/memory');
      persistMemory();
    } catch { /* offline: Kopie bleibt */ } finally {
      memoryLoading.value = false;
    }
  }

  function openMemory() {
    memoryOpen.value = true;
    void loadMemory();
  }

  /** Fehler einheitlich melden: ohne Netz geht Verwalten nicht (das Gedächtnis lebt im Konto). */
  function memoryError(e: unknown) {
    useUiStore().toast(isApiError(e) && e.isNetwork ? t('ai.memory.needsConnection') : isApiError(e) ? e.message : t('ai.errors.unknown'), 'error');
  }

  async function addMemory(content: string, category: MemoryCategory, importance: 1 | 2 | 3 = 2): Promise<boolean> {
    try {
      const created = await app.api().post<CoachMemory>('/api/ai/memory', { content, category, importance });
      memory.value = [created, ...memory.value.filter((m) => m.id !== created.id)];
      persistMemory();
      void loadMemory();
      return true;
    } catch (e) { memoryError(e); return false; }
  }

  async function updateMemory(entry: CoachMemory, content: string, category: MemoryCategory, importance: 1 | 2 | 3): Promise<boolean> {
    try {
      const saved = await app.api().put<CoachMemory>(`/api/ai/memory/${entry.id}`, { content, category, importance, expiresAt: entry.expiresAt });
      memory.value = memory.value.map((m) => (m.id === saved.id ? saved : m));
      persistMemory();
      return true;
    } catch (e) { memoryError(e); return false; }
  }

  async function forgetMemory(id: number): Promise<boolean> {
    try {
      await app.api().del(`/api/ai/memory/${id}`);
    } catch (e) {
      // Schon weg (z. B. auf einem anderen Gerät gelöscht) zählt als Erfolg
      if (!(isApiError(e) && e.status === 404)) { memoryError(e); return false; }
    }
    memory.value = memory.value.filter((m) => m.id !== id);
    persistMemory();
    return true;
  }

  /** "Rückgängig" unter einer Antwort: gerade Gemerktes wieder vergessen. */
  async function undoMemory(messageIndex: number, change: MemoryChange) {
    if (change.action !== 'saved' || change.undone) return;
    if (!(await forgetMemory(change.id))) return;
    messages.value = messages.value.map((m, i) => (i === messageIndex && m.memory
      ? { ...m, memory: m.memory.map((c) => (c.id === change.id ? { ...c, undone: true } : c)) }
      : m));
    persist();
    useUiStore().toast(t('ai.memory.undone'), 'success');
  }

  /** confirmed: per Gedrückthalten bestätigt; sonst (Tastatur/Screenreader) mit Rückfrage. */
  async function clearMemory(opts?: { confirmed?: boolean }): Promise<boolean> {
    const ok = opts?.confirmed === true || await useUiStore().confirm({
      title: t('ai.memory.clearTitle'), message: t('ai.memory.clearMessage'), confirmText: t('ai.memory.clearConfirm'), danger: true,
    });
    if (!ok) return false;
    try {
      await app.api().del('/api/ai/memory');
      memory.value = [];
      persistMemory();
      useUiStore().toast(t('ai.memory.cleared'), 'success');
      return true;
    } catch (e) { memoryError(e); return false; }
  }

  async function saveProfile(next: AthleteProfile) {
    const ui = useUiStore();
    profileBusy.value = true;
    profile.value = { ...next, pending: true };
    persistProfile();
    try {
      const synced = await pushProfile();
      ui.toast(t(synced ? 'ai.profile.saved' : 'ai.profile.savedOffline'), 'success');
      profileOpen.value = false;
    } catch (e) {
      ui.toast(isApiError(e) ? e.message : t('ai.errors.unknown'), 'error');
    } finally {
      profileBusy.value = false;
    }
  }

  /** confirmed: schon per Gedrückthalten bestätigt (HoldButton) - keine Rückfrage. */
  async function clearChat(opts?: { confirmed?: boolean }) {
    const ok = opts?.confirmed === true || await useUiStore().confirm({ title: t('ai.clear.title'), message: t('ai.clear.message'), confirmText: t('ai.clear.confirm'), danger: true });
    if (!ok) return;
    messages.value = [];
    error.value = null;
    persist();
  }

  // ---------- Plan von der KI ----------

  async function generatePlan(answers: PlanAnswers) {
    const pl = plan.value;
    if (pl.busy) return;
    if (!deviceOnline.value) { pl.error = 'offline'; return; }
    pl.busy = true;
    pl.error = null;
    pl.result = null;
    try {
      const res = await aiPost<{ program: AiProgramDraft; summary: string; remaining: number }>('/api/ai/plan', {
        answers: { ...answers }, notes: pl.notes.trim() || null, context: context(), locale: locale.value, requestId: newRequestId(),
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
    pl.saving = true;
    try {
      const ok = await saveProgramDraft(pl.result.program, scheduleFor(pl.result.answers));
      if (ok) {
        plan.value = { busy: false, error: null, notes: '', result: null, saving: false };
        app.planBuilder.open = false;
      }
      return ok;
    } finally {
      pl.saving = false;
    }
  }

  return {
    status, enabled, open, messages, busy, error, mode, applying, plan, analysis, analysisBusy, analysisError,
    profile, profileOpen, profileBusy, profileFilled, cost, left, deviceOnline,
    loadStatus, openChat, ask, retry, askFromElsewhere, clearChat, applyAction, generatePlan, discardPlan, acceptPlan,
    runAnalysis, loadProfile, openProfile, saveProfile, context,
    memory, memoryOpen, memoryLoading, loadMemory, openMemory, addMemory, updateMemory, forgetMemory, undoMemory, clearMemory,
  };
});
