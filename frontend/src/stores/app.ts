// Zentraler App-Zustand (Pinia Setup-Store): Auth, Daten + Offline-Sync, laufende Einheit, Pläne, Einstellungen.
// Fachlogik liegt in src/lib (unit-getestet); hier wird sie mit Zustand, API und Persistenz verbunden.

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { createApi, type Api, type FieldErrors, isApiError } from '../lib/api';
import { Keys, userKeys, readJson, writeJson, remove, decodeToken, newClientId } from '../lib/storage';
import { syncQueue, queueAsWorkouts, migrateLegacyQueue, QueueStatus, isUpdate } from '../lib/sync';
import { fetchChanges, mergeChanges, sortHistory } from '../lib/history';
import {
  TrackingType, trackingOf, epley1RM, setSpeed, msToKmh, trainingZone, roundTo, exerciseKey,
  computeRecords, detectPRs, workoutKey, summarizeWorkout, groupSetsByExercise, metricsFor,
  exerciseSeries, weeklyTotals, weekStreak, muscleDistribution, activityHeatmap, lastSetFor,
  usageCounts, inferWorkoutType, percentChange, dateKey, type ExerciseRecord, type MetricOption,
} from '../lib/analytics';
import { formatNumber, formatClock, formatDate, formatRelative, formatSeconds, describeSet, toLocalInput } from '../lib/format';
import { unlockAudio, playRestAlarm, createWakeLock } from '../lib/feedback';
import { exportCsv, exportJson } from '../lib/export';
import { techniqueFor, BODYWEIGHT_EXERCISES } from '../lib/figure';
import { blockOrder, ghostFor, matchScore, normalize, previousSets, type GhostValues } from '../lib/workout';
import { exerciseAliases } from '../i18n/aliases';
import { localDay, readiness, readinessAdvice, readinessTrend, weeklyAverage, type WellnessEntry, type WellnessField } from '../lib/wellness';
import {
  programStatus, suggestTarget, setsDone, loadStatus, ZONE_INFO, effectivePrescription, programProgress,
  emptyProgramDraft, emptyDraftRow, toDraft, draftToPayload,
  type ProgramDraft, type DraftDay, type TargetSuggestion, type DraftExercise,
} from '../lib/program';
import type { WeeklyMetric } from '../lib/charts';
import type {
  AuthResult, AuthUser, Exercise, Profile, ProgramDay, ProgramExercise, ProgramTemplate, QueueEntry,
  TrackingType as TrackingTypeValue, TrainingProgram, Workout, WorkoutSet,
} from '../types';
import { useUiStore } from './ui';
import { t, tn, tDynamic, intlLocale, textIn, SUPPORTED_LOCALES } from '../i18n';
import { templateText, localizedTechnique, exerciseName as trExerciseName, dayName as trDayName, programName as trProgramName } from '../i18n/content';

// ---------- Konstanten ----------

export const DEFAULT_SETTINGS = Object.freeze({
  restGym: 90,
  restField: 120,
  autoTimer: true,
  sound: true,
  vibration: true,
  wakeLock: true,
  showTechnique: true,
  /** Anstrengung pro Satz als RIR (Wdh. in Reserve) statt RPE anzeigen/eingeben. Gespeichert wird immer RPE (RIR = 10 - RPE). */
  useRir: false,
});
export type Settings = { -readonly [K in keyof typeof DEFAULT_SETTINGS]: (typeof DEFAULT_SETTINGS)[K] extends boolean ? boolean : number };

const DEFAULTS = Object.freeze({ weight: 20, reps: 10, distance: 30, time: 4.5, duration: 60 });

/** RPE-Werte für Sätze (Reps in Reserve: 10 = Maximum, 8 = noch 2 Wiederholungen möglich). */
export const SET_RPE = Object.freeze([6, 7, 7.5, 8, 8.5, 9, 9.5, 10]);

/** Session-RPE nach Borg CR-10 (Foster). */
export const SESSION_RPE = Object.freeze([
  { value: 1, label: 'Very easy' }, { value: 2, label: 'Easy' }, { value: 3, label: 'Moderate' },
  { value: 4, label: 'Somewhat hard' }, { value: 5, label: 'Hard' }, { value: 6, label: 'Hard+' },
  { value: 7, label: 'Very hard' }, { value: 8, label: 'Very hard+' }, { value: 9, label: 'Extreme' },
  { value: 10, label: 'Maximal' },
]);

export type Tab = 'Gym' | 'Football' | 'Plan' | 'Data';
/** Workout-Typ eines Spiels (ohne Sätze). */
export const MATCH = 'Match';
export type DataTab = 'overview' | 'history' | 'progress' | 'records' | 'calendar';
export type SortMode = 'fav' | 'freq' | 'recent' | 'az' | 'za';

// ---------- Typen der laufenden Einheit ----------

export interface SessionSet extends WorkoutSet {
  exerciseId: number;
  exerciseName: string;
  trackingType: TrackingTypeValue;
}

export interface PlanTarget extends ProgramExercise {
  name?: string;
  category: string;
  suggestion: TargetSuggestion;
}

export interface SessionPlan {
  programId?: number;
  programName?: string;
  dayId: number;
  dayName: string;
  targets: PlanTarget[];
}

type Editing = { kind: 'server'; id: number; clientId?: string | null } | { kind: 'pending'; clientId: string };

export interface SessionMeta {
  date: string;
  durationSeconds?: number | null;
  sessionRpe?: number | null;
  quality?: number | null;
  notes?: string | null;
  programDayId?: number | null;
}

export interface Session {
  startedAt: string | null;
  sets: SessionSet[];
  editing: Editing | null;
  meta: SessionMeta | null;
  plan: SessionPlan | null;
  /** Reihenfolge der Übungs-Blöcke (auch Übungen ohne Satz - "hinzugefügt, kommt gleich"). */
  order?: number[];
  /** Geplante Sätze pro Übung (z. B. aus "Wiederholen") - belegen den n-ten Satz vor. */
  templates?: Record<number, WorkoutSet[]>;
}

/** Ein Übungs-Block der laufenden Einheit (Anzeige). */
export interface WorkoutBlock {
  exercise: Exercise;
  sets: (SessionSet & { index: number })[];
  workingDone: number;
  target: PlanTarget | null;
  previous: WorkoutSet[];
  ghost: GhostValues;
}

export type PickerFilter = 'recent' | 'favorites' | 'all';

export const sortOptions: readonly { key: SortMode; label: string }[] = Object.freeze([
  { key: 'fav', label: 'Favorites' },
  { key: 'freq', label: 'Most used' },
  { key: 'recent', label: 'Recently trained' },
  { key: 'az', label: 'A - Z' },
  { key: 'za', label: 'Z - A' },
]);

const EMPTY_SESSION = (): Session => ({ startedAt: null, sets: [], editing: null, meta: null, plan: null });

interface SetModal {
  open: boolean;
  exercise: Exercise | null;
  editIndex: number | null;
  weight: number;
  reps: number;
  distance: number;
  time: number;
  rpe: number | null;
  isWarmup: boolean;
  note: string;
  showNote: boolean;
}

interface Timer { endAt: number | null; duration: number }

const closedSetModal = (): SetModal => ({ open: false, exercise: null, editIndex: null, weight: 0, reps: 0, distance: 0, time: 0, rpe: null, isWarmup: false, note: '', showNote: false });

const wakeLock = createWakeLock();
let reloadOnControllerChange = false;

/** Token einer älteren App-Version (localStorage). Wird beim ersten Refresh gegen eine Cookie-Sitzung getauscht. */
function readLegacyToken(): string | null {
  try { return localStorage.getItem(Keys.token) || null; } catch { return null; }
}
function removeLegacyToken(): void { remove(Keys.token); }

export type AuthMode = 'login' | 'register' | 'recover' | 'forgot' | 'reset';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isNetworkError = (e: unknown) => isApiError(e) && e.isNetwork;
/** Danach gilt ein laufender Sync als hängend und ein neuer darf starten (ein Request hat 15 s Timeout, Refresh inklusive ~45 s). */
export const SYNC_LOCK_MS = 60_000;

export const useAppStore = defineStore('app', () => {
  const ui = useUiStore();
  const { toast, confirm } = ui;

  // =====================================================================
  // Zustand
  // =====================================================================

  // Auth (die Sitzung selbst liegt in httpOnly-Cookies - hier nur, wer angemeldet ist)
  const user = ref<AuthUser | null>(null);
  const authMode = ref<AuthMode>('login');
  const authForm = ref({ username: '', password: '', code: '', newPassword: '', login: '' });
  const authNotice = ref('');
  const authOptions = ref({ emailEnabled: false });
  const resetToken = ref<string | null>(null);
  /** Frisch erzeugte Wiederherstellungscodes - werden genau einmal angezeigt. */
  const recoveryCodes = ref<string[] | null>(null);
  const authBusy = ref(false);
  const authError = ref('');
  const authFields = ref<FieldErrors>({});
  const booting = ref(true);

  // Verbindung / Sync
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
  const syncing = ref(false);
  const updateWorker = ref<ServiceWorker | null>(null);

  // Daten
  const exercises = ref<Exercise[]>([]);
  const history = ref<Workout[]>([]);
  const favorites = ref<number[]>([]);
  const queue = ref<QueueEntry[]>([]);
  const loadingExercises = ref(false);
  const loadingHistory = ref(false);
  const programs = ref<TrainingProgram[]>([]);
  const templates = ref<ProgramTemplate[]>([]);
  const loadingPrograms = ref(false);
  const programEditor = ref({ open: false, draft: emptyProgramDraft() as ProgramDraft, busy: false, error: '' });
  const expandedDay = ref<number | null>(null);

  // Navigation
  const tab = ref<Tab>('Gym');
  const dataTab = ref<DataTab>('overview');

  // Übungsliste
  const search = ref('');
  const sortMode = ref<SortMode>('fav');
  const sortOpen = ref(false);
  const muscleFilters = ref<string[]>([]);

  // Laufende Einheit
  const session = ref<Session>(EMPTY_SESSION());
  const showReview = ref(false);
  const finishModal = ref({ open: false, sessionRpe: null as number | null, quality: null as number | null, notes: '', date: '', durationMin: null as number | null, error: '' });

  // Satz-Dialog
  const setModal = ref<SetModal>(closedSetModal());

  // Eigene Übung
  const customModal = ref({ open: false, name: '', category: 'Gym', muscleGroup: '', trackingType: TrackingType.WeightReps as TrackingTypeValue, busy: false, error: '', addToWorkout: false });

  // Einstellungen
  const settingsOpen = ref(false);
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const profile = ref<Profile | null>(null);
  const deleteAccount = ref({ open: false, password: '', busy: false, error: '' });
  const security = ref({ section: '' as '' | 'password' | 'email' | 'codes', current: '', next: '', email: '', busy: false, error: '', notice: '' });

  // Pausentimer
  const timer = ref<Timer>({ endAt: null, duration: 0 });
  const now = ref(Date.now());    // Sekundentakt (Timer, Session-Dauer)
  const clock = ref(Date.now());  // Minutentakt (Auswertungen)

  // Auswertungen
  const historyFilter = ref<'all' | 'Gym' | 'Football' | 'Hybrid' | 'Match'>('all');
  const historyLimit = ref(20);
  const progress = ref({ key: '', metric: '' });
  const weeklyMetric = ref<WeeklyMetric>('volume');
  const selectedDay = ref<string | null>(null);

  // =====================================================================
  // Abgeleitete Werte
  // =====================================================================

  const isAuthenticated = computed(() => !!user.value);
  const keys = computed(() => (user.value ? userKeys(user.value.userId) : null));

  const exercisesById = computed(() => new Map(exercises.value.map((e) => [e.id, e])));

  /** Server-Historie + noch nicht synchronisierte Einheiten, neueste zuerst. */
  const allWorkouts = computed<Workout[]>(() => {
    const pending = queueAsWorkouts(queue.value);
    const pendingIds = new Set(pending.map((w) => w.clientId));
    // Noch nicht synchronisierte Änderungen ersetzen die Server-Version in der Anzeige.
    const updatedIds = new Set(pending.filter((w) => w.op === 'update').map((w) => w.id));
    const synced = history.value.filter((w) => !(w.clientId && pendingIds.has(w.clientId)) && !updatedIds.has(w.id));
    return [...pending, ...synced].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  const records = computed(() => computeRecords(allWorkouts.value));
  const prInfo = computed(() => detectPRs(allWorkouts.value));
  const usage = computed(() => usageCounts(allWorkouts.value));
  const clockDate = computed(() => new Date(clock.value));

  // ---------- Trainingspläne ----------
  const activeProgram = computed(() => programs.value.find((p) => p.isActive) ?? null);
  const otherPrograms = computed(() => programs.value.filter((p) => !p.isActive));
  const programInfo = computed(() => (activeProgram.value ? programStatus(activeProgram.value, allWorkouts.value, clockDate.value) : null));
  /** Planwoche des aktiven Plans (über das Planende hinaus wird weitergezählt - Zyklen laufen weiter). */
  const planWeek = computed(() => programInfo.value?.week ?? 1);
  const isDeloadNow = computed(() => !!activeProgram.value && effectivePrescription({ exerciseId: 0, sets: 1 }, activeProgram.value, planWeek.value).deload);
  /** Vorgabe einer Übung des aktiven Plans für die aktuelle Woche (Wochen-Stufen, Zyklus, Entlastung). */
  function currentPrescription(px: ProgramExercise) {
    return effectivePrescription(px, activeProgram.value, planWeek.value);
  }
  const templateFilter = ref<'all' | 'Football' | 'Gym'>('all');
  const filteredTemplates = computed(() =>
    templateFilter.value === 'all' ? templates.value : templates.value.filter((tpl) => (tpl.category ?? 'Gym') === templateFilter.value));
  const loadInfo = computed(() => loadStatus(allWorkouts.value, clockDate.value));
  const loadZone = computed(() => {
    const zone = loadInfo.value.zone;
    return { ...ZONE_INFO[zone], label: tDynamic(`plan.zones.${zone}.label`, ZONE_INFO[zone].label), advice: tDynamic(`plan.zones.${zone}.advice`, ZONE_INFO[zone].advice) };
  });
  const planTargets = computed(() => (session.value.plan?.targets ?? []).map((t) => ({ ...t, done: setsDone(t.exerciseId, session.value.sets) })));
  const planProgress = computed(() => {
    const t = planTargets.value;
    const total = t.reduce((sum, x) => sum + x.sets, 0);
    const done = t.reduce((sum, x) => sum + Math.min(x.done, x.sets), 0);
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  });
  const exerciseGroups = computed(() => {
    const byCat = (cat: string) => exercises.value.filter((e) => e.category === cat).sort((a, b) => a.name.localeCompare(b.name));
    return [{ label: 'Gym', category: 'Gym', items: byCat('Gym') }, { label: 'Field', category: 'Football', items: byCat('Football') }];
  });

  const pendingCount = computed(() => queue.value.filter((q) => q.status === QueueStatus.Pending).length);
  const failedCount = computed(() => queue.value.filter((q) => q.status === QueueStatus.Failed).length);

  const syncState = computed(() => {
    if (!online.value) return { label: pendingCount.value ? `${t('sync.offline')} · ${tn('sync.pending', pendingCount.value)}` : t('sync.offline'), tone: 'red' };
    if (syncing.value) return { label: t('sync.syncing'), tone: 'blue' };
    if (failedCount.value) return { label: tn('sync.failed', failedCount.value), tone: 'red' };
    if (pendingCount.value) return { label: tn('sync.pending', pendingCount.value), tone: 'orange' };
    return { label: t('sync.synced'), tone: 'green' };
  });

  // ---------- Übungsliste ----------
  const categoryExercises = computed(() => exercises.value.filter((e) => e.category === tab.value));
  const availableMuscleGroups = computed(() => [...new Set(categoryExercises.value.map((e) => e.muscleGroup || 'Other'))].sort());
  const allMuscleGroups = computed(() => [...new Set(exercises.value.map((e) => e.muscleGroup).filter((m): m is string => !!m))].sort());

  /**
   * Suchindex: offizielle Namen in ALLEN Sprachen + Synonyme/Slang + Muskelgruppen (normalisiert).
   * So findet "Bizepsmaschine", "становая" oder "latzug" die richtige Übung - egal, welche App-Sprache aktiv ist.
   */
  const searchIndex = computed(() => {
    const index = new Map<number, string[]>();
    for (const e of exercises.value) {
      const names = [e.name, trExerciseName(e)];
      if (!e.isCustom && e.id < 1000) for (const lang of SUPPORTED_LOCALES) names.push(textIn(lang, `exercises.${e.id}`) ?? '');
      const muscles = e.muscleGroup ? SUPPORTED_LOCALES.map((lang) => textIn(lang, `muscles.${e.muscleGroup}`) ?? '') : [];
      index.set(e.id, [...new Set([...names, ...(exerciseAliases[e.id] ?? []), e.muscleGroup ?? '', ...muscles].map(normalize).filter(Boolean))]);
    }
    return index;
  });

  /** Übungen nach Suchtreffer sortiert (bester zuerst). */
  function searchExercises(query: string, list: readonly Exercise[]): Exercise[] {
    if (!normalize(query)) return [...list];
    return list
      .map((e) => ({ e, score: matchScore(query, searchIndex.value.get(e.id) ?? [normalize(e.name)]) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.e);
  }

  const filteredExercises = computed(() => {
    const q = search.value.trim();
    let list = categoryExercises.value;
    if (q) list = searchExercises(q, list);
    if (muscleFilters.value.length) list = list.filter((e) => muscleFilters.value.includes(e.muscleGroup || 'Other'));

    const fav = (e: Exercise) => (favorites.value.includes(e.id) ? 1 : 0);
    const used = (e: Exercise) => usage.value.get(`id:${e.id}`) ?? 0;
    const last = (e: Exercise) => records.value.get(`id:${e.id}`)?.lastDate ?? '';
    const byName = (a: Exercise, b: Exercise) => trExerciseName(a).localeCompare(trExerciseName(b), intlLocale());
    const sorters: Record<SortMode, (a: Exercise, b: Exercise) => number> = {
      fav: (a, b) => fav(b) - fav(a) || byName(a, b),
      freq: (a, b) => used(b) - used(a) || byName(a, b),
      recent: (a, b) => String(last(b)).localeCompare(String(last(a))) || byName(a, b),
      az: byName,
      za: (a, b) => byName(b, a),
    };
    return q ? list : [...list].sort(sorters[sortMode.value] ?? byName);
  });

  const sortLabel = computed(() => tDynamic(`catalog.sort.${sortMode.value}`, sortOptions.find((o) => o.key === sortMode.value)?.label ?? ''));

  // ---------- Laufende Einheit ----------
  /** Eine Einheit läuft, sobald ein Satz geloggt ODER eine Übung hinzugefügt wurde. */
  const sessionActive = computed(() => session.value.sets.length > 0 || (session.value.order?.length ?? 0) > 0 || !!session.value.plan);
  const hasSets = computed(() => session.value.sets.length > 0);
  const isEditing = computed(() => !!session.value.editing);
  const finishLoad = computed(() => {
    const f = finishModal.value;
    return (f.sessionRpe ?? 0) > 0 && (f.durationMin ?? 0) > 0 ? Math.round(f.sessionRpe! * f.durationMin!) : 0;
  });
  const sessionElapsed = computed(() => (session.value.startedAt ? Math.max(0, (now.value - new Date(session.value.startedAt).getTime()) / 1000) : 0));
  const sessionGroups = computed(() => groupSetsByExercise(session.value.sets));
  const sessionSummary = computed(() => summarizeWorkout({ sets: session.value.sets }));

  // ---------- Satz-Dialog ----------
  const modalEx = computed(() => setModal.value.exercise);
  const modalType = computed<TrackingTypeValue>(() => modalEx.value?.trackingType ?? TrackingType.WeightReps);
  const modalKey = computed(() => (modalEx.value ? exerciseKey({ exerciseId: modalEx.value.id, exerciseName: modalEx.value.name }) : ''));
  const modalRecord = computed<ExerciseRecord | null>(() => (modalEx.value ? records.value.get(modalKey.value) ?? null : null));
  const modalPrevious = computed(() => (modalEx.value ? lastSetFor(allWorkouts.value, modalKey.value) : null));
  const modalSessionSets = computed(() => session.value.sets.filter((s) => s.exerciseId === modalEx.value?.id));
  const modalTechnique = computed(() => {
    const info = techniqueFor(modalEx.value);
    return { ...info, technique: localizedTechnique(info.key, info.technique) };
  });
  const modalTarget = computed(() => planTargetFor(modalEx.value?.id));
  const modalE1RM = computed(() => epley1RM(setModal.value.weight, setModal.value.reps));
  const modalIntensity = computed(() => {
    const pr = modalRecord.value?.maxWeight?.value ?? 0;
    return pr > 0 && setModal.value.weight > 0 ? Math.round((setModal.value.weight / pr) * 100) : 0;
  });
  const modalZone = computed(() => trainingZone(setModal.value.reps));
  const modalSpeed = computed(() => setSpeed({ distance: setModal.value.distance, time: setModal.value.time }));
  const modalSpeedVsBest = computed(() => {
    const best = modalRecord.value?.topSpeed?.value ?? 0;
    return best > 0 && modalSpeed.value > 0 ? Math.round((modalSpeed.value / best) * 100) : 0;
  });
  const modalIsNewPR = computed(() => {
    const r = modalRecord.value;
    if (!r || setModal.value.isWarmup) return false;
    if (modalType.value === TrackingType.WeightReps) return (r.maxWeight?.value ?? 0) > 0 && setModal.value.weight > r.maxWeight!.value;
    if (modalType.value === TrackingType.DistanceTime) return (r.topSpeed?.value ?? 0) > 0 && modalSpeed.value > r.topSpeed!.value;
    return (r.longest?.value ?? 0) > 0 && setModal.value.time > r.longest!.value;
  });

  // ---------- Pausentimer ----------
  const timerActive = computed(() => !!timer.value.endAt);
  const timerLeft = computed(() => (timer.value.endAt ? Math.max(0, Math.ceil((timer.value.endAt - now.value) / 1000)) : 0));
  const timerProgress = computed(() => (timer.value.duration ? Math.min(1, timerLeft.value / timer.value.duration) : 0));

  // ---------- Auswertungen ----------
  const weekly = computed(() => weeklyTotals(allWorkouts.value, 12, clockDate.value));
  const kpis = computed(() => {
    const weeks = weekly.value;
    const current = weeks[weeks.length - 1] ?? { volume: 0, sessions: 0, distance: 0 };
    const previous = weeks[weeks.length - 2] ?? { volume: 0, sessions: 0, distance: 0 };
    return {
      sessions: current.sessions,
      sessionsPrev: previous.sessions,
      volume: current.volume,
      volumeChange: percentChange(current.volume, previous.volume),
      distance: current.distance,
      streak: weekStreak(allWorkouts.value, clockDate.value),
      total: allWorkouts.value.length,
    };
  });
  const muscleSplit = computed(() => muscleDistribution(allWorkouts.value, 30, clockDate.value).slice(0, 8));
  const recentPRs = computed(() => prInfo.value.events.slice(0, 6));

  const filteredHistory = computed(() =>
    historyFilter.value === 'all' ? allWorkouts.value : allWorkouts.value.filter((w) => w.workoutType === historyFilter.value));
  const visibleHistory = computed(() => filteredHistory.value.slice(0, historyLimit.value));

  const progressOptions = computed(() => [...records.value.values()].filter((r) => r.sessions > 0).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')));
  const progressRecord = computed(() => records.value.get(progress.value.key) ?? null);
  const progressMetrics = computed<MetricOption[]>(() => metricsFor(progressRecord.value?.trackingType));
  const progressMetric = computed<MetricOption>(() => progressMetrics.value.find((m) => m.key === progress.value.metric) ?? progressMetrics.value[0]);
  const progressSeries = computed(() => (progressRecord.value ? exerciseSeries(allWorkouts.value, progress.value.key, progressMetric.value.key) : []));
  const progressDelta = computed(() => {
    const s = progressSeries.value;
    if (s.length < 2) return null;
    const change = percentChange(s[s.length - 1].value, s[0].value);
    return progressMetric.value.lowerIsBetter && change !== null ? -change : change;
  });

  const recordList = computed(() => [...records.value.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')));
  const heatmap = computed(() => activityHeatmap(allWorkouts.value, 26, clockDate.value, intlLocale()));
  const selectedDayWorkouts = computed(() => (selectedDay.value ? allWorkouts.value.filter((w) => dateKey(w.date) === selectedDay.value) : []));
  const activeDaysLast30 = computed(() => {
    const since = clock.value - 30 * 86_400_000;
    return new Set(allWorkouts.value.filter((w) => new Date(w.date).getTime() >= since).map((w) => dateKey(w.date))).size;
  });

  // =====================================================================
  // Auth
  // =====================================================================
  // Eine Instanz für die ganze App: gleichzeitige 401 teilen sich genau einen Refresh.
  const client = createApi({
    onUnauthorized: () => handleUnauthorized(),
    getLegacyToken: readLegacyToken,
    onLegacyTokenUsed: removeLegacyToken,
  });
  function api(): Api { return client; }

  async function submitAuth() {
    authError.value = '';
    authNotice.value = '';
    authFields.value = {};
    const f = authForm.value;
    const username = f.username.trim();
    const mode = authMode.value;

    // Clientseitige Vorprüfung (der Server prüft trotzdem)
    if (mode === 'forgot') {
      if (!f.login.trim()) { authError.value = t('auth.errors.loginRequired'); return; }
    } else if (mode === 'reset') {
      if (f.newPassword.length < 8) { authFields.value = { newPassword: [t('auth.errors.passwordShort')] }; return; }
    } else {
      if (!username) { authError.value = t('auth.errors.usernameRequired'); return; }
      if (mode === 'recover') {
        if (!f.code.trim()) { authFields.value = { code: [t('auth.errors.codeRequired')] }; return; }
        if (f.newPassword.length < 8) { authFields.value = { newPassword: [t('auth.errors.passwordShort')] }; return; }
      } else if (!f.password) {
        authError.value = t('auth.errors.credentialsRequired');
        return;
      } else if (mode === 'register' && f.password.length < 8) {
        authFields.value = { password: [t('auth.errors.passwordShort')] };
        return;
      }
    }

    authBusy.value = true;
    try {
      if (mode === 'forgot') {
        await api().post('/api/auth/forgot-password', { login: f.login.trim() });
        authNotice.value = t('auth.notice.resetSent');
        return;
      }
      const request: Record<AuthMode, [string, unknown]> = {
        login: ['/api/auth/login', { username, password: f.password }],
        register: ['/api/auth/register', { username, password: f.password }],
        recover: ['/api/auth/recover', { username, code: f.code, newPassword: f.newPassword }],
        reset: ['/api/auth/reset-password', { token: resetToken.value, newPassword: f.newPassword }],
        forgot: ['', null],
      };
      const [path, body] = request[mode];
      const result = await api().post<AuthResult>(path, body);
      if (result.recoveryCodes?.length) recoveryCodes.value = result.recoveryCodes;
      await completeSignIn({ userId: result.userId, username: result.username }, {
        login: t('auth.toast.login', { name: result.username }),
        register: t('auth.toast.register', { name: result.username }),
        recover: t('auth.toast.recover'),
        reset: t('auth.toast.reset'),
        forgot: '',
      }[mode]);
    } catch (e) {
      authError.value = isNetworkError(e) ? t('auth.errors.offline') : errorMessage(e);
      authFields.value = isApiError(e) ? e.fields : {};
    } finally {
      authBusy.value = false;
    }
  }

  async function completeSignIn(signedIn: AuthUser, message: string) {
    setAuth(signedIn);
    authForm.value = { username: '', password: '', code: '', newPassword: '', login: '' };
    resetToken.value = null;
    authMode.value = 'login';
    hydrate();
    toast(message, 'success');
    await refreshAll();
  }

  function setAuthMode(mode: AuthMode) {
    authMode.value = mode;
    authError.value = '';
    authNotice.value = '';
    authFields.value = {};
  }

  function toggleAuthMode() { setAuthMode(authMode.value === 'login' ? 'register' : 'login'); }

  async function loadAuthOptions() {
    try { authOptions.value = await api().get<{ emailEnabled: boolean }>('/api/auth/options'); } catch { /* offline: ohne E-Mail-Option */ }
  }

  function fieldError(field: string): string {
    const entry = Object.entries(authFields.value).find(([k]) => k.toLowerCase() === field);
    return entry ? entry[1][0] : '';
  }

  function setAuth(newUser: AuthUser) {
    user.value = newUser;
    writeJson(Keys.user, newUser);
  }

  /** Beim Start: Sitzung erneuern (gleitende 30 Tage). Offline bleibt man angemeldet und arbeitet lokal. */
  async function refreshSession() {
    try {
      if (await client.refreshSession()) online.value = true;
      else handleUnauthorized();
    } catch (e) {
      if (isNetworkError(e)) online.value = false;
    }
  }

  function handleUnauthorized() {
    if (!user.value) return;
    toast(t('auth.errors.sessionExpired'), 'error');
    clearAuth();
  }

  async function logout() {
    if (queue.value.length) {
      const ok = await confirm({
        title: t('settings.confirm.unsyncedTitle'),
        message: tn('settings.confirm.unsyncedMessage', queue.value.length),
        confirmText: t('settings.confirm.logout'),
      });
      if (!ok) return;
    }
    settingsOpen.value = false;
    try { await api().post('/api/auth/logout'); } catch { /* offline: Cookies laufen ab, Server-Sitzung bleibt bis dahin */ }
    clearAuth();
  }

  function clearAuth() {
    // Cache der Historie entfernen (geteilte Geräte); Queue + laufende Einheit bleiben für dieses Konto erhalten.
    const k = keys.value;
    if (k) {
      remove(k.history);
      remove(k.historyToken);
      remove(k.exercises);
      remove(k.favorites);
      remove(k.programs);
      remove(k.wellness);
    }
    removeLegacyToken();
    remove(Keys.user);
    user.value = null;
    recoveryCodes.value = null;
    exercises.value = [];
    history.value = [];
    favorites.value = [];
    programs.value = [];
    templates.value = [];
    queue.value = [];
    session.value = EMPTY_SESSION();
    timer.value = { endAt: null, duration: 0 };
    profile.value = null;
    tab.value = 'Gym';
    closeAllLayers();
  }

  // =====================================================================
  // Daten laden / Cache
  // =====================================================================
  function hydrate() {
    const k = keys.value!;
    exercises.value = readJson<Exercise[]>(k.exercises, []);
    history.value = readJson<Workout[]>(k.history, []);
    favorites.value = readJson<number[]>(k.favorites, []);
    queue.value = readJson<QueueEntry[]>(k.queue, []);
    session.value = { ...EMPTY_SESSION(), ...readJson<Partial<Session>>(k.session, {}) };
    timer.value = readJson<Timer>(k.timer, { endAt: null, duration: 0 });
    programs.value = readJson<TrainingProgram[]>(k.programs, []);
    templates.value = readJson<ProgramTemplate[]>(k.templates, []);
    migrateLegacyStorage();
  }

  /** Übernimmt Daten aus v2 (globale Schlüssel ohne Nutzerbezug). */
  function migrateLegacyStorage() {
    const legacyQueue = readJson<Parameters<typeof migrateLegacyQueue>[0]>(Keys.legacyQueue);
    if (Array.isArray(legacyQueue)) {
      const migrated = migrateLegacyQueue(legacyQueue, newClientId);
      if (migrated.length) queue.value = [...queue.value, ...migrated];
      remove(Keys.legacyQueue);
      persistQueue();
    }
    const legacySets = readJson<(WorkoutSet & { exerciseId: number })[]>(Keys.legacySets);
    if (Array.isArray(legacySets)) {
      if (!session.value.sets.length && legacySets.length) {
        session.value = {
          ...EMPTY_SESSION(),
          startedAt: new Date().toISOString(),
          sets: legacySets.map((s) => ({ ...s, exerciseName: s.exerciseName ?? s.name ?? '?', trackingType: trackingOf(s) })),
        };
        persistSession();
      }
      remove(Keys.legacySets);
    }
  }

  async function refreshAll({ refreshToken: refresh = false } = {}) {
    if (!isAuthenticated.value) return;
    if (refresh) await refreshSession();
    if (!isAuthenticated.value) return;
    await Promise.allSettled([loadExercises(), loadFavorites(), loadPrograms(), loadTemplates(), loadWellness()]);
    await syncNow({ reload: false });
    await loadHistory();
  }

  async function loadExercises() {
    loadingExercises.value = !exercises.value.length;
    try {
      exercises.value = await api().get<Exercise[]>('/api/exercises');
      writeJson(keys.value!.exercises, exercises.value);
      online.value = true;
      enrichSession();
    } catch (e) {
      if (isNetworkError(e)) online.value = false;
    } finally {
      loadingExercises.value = false;
    }
  }

  /**
   * Delta-Sync: beim ersten Mal die komplette Historie (seitenweise), danach nur Änderungen seit dem letzten Abgleich.
   * Bei ungültigem Token (z. B. nach einem Server-Reset) einmal komplett neu laden.
   */
  async function loadHistory({ full = false } = {}): Promise<boolean> {
    if (!isAuthenticated.value) return false;
    const k = keys.value!;
    loadingHistory.value = !history.value.length;
    const since = full || !history.value.length ? null : readJson<string>(k.historyToken);
    try {
      const changes = await fetchChanges(api(), since);
      if (!isAuthenticated.value || keys.value?.history !== k.history) return false; // inzwischen abgemeldet / Konto gewechselt
      history.value = since ? mergeChanges(history.value, changes) : sortHistory(changes.workouts);
      writeJson(k.history, history.value);
      writeJson(k.historyToken, changes.token);
      online.value = true;
      return true;
    } catch (e) {
      if (isNetworkError(e)) online.value = false;
      if (since && isApiError(e) && e.status === 400) return loadHistory({ full: true });
      return false;
    } finally {
      loadingHistory.value = false;
    }
  }

  async function loadPrograms() {
    if (!isAuthenticated.value) return;
    loadingPrograms.value = !programs.value.length;
    try {
      programs.value = await api().get<TrainingProgram[]>('/api/programs');
      writeJson(keys.value!.programs, programs.value);
    } catch (e) {
      if (isNetworkError(e)) online.value = false;
    } finally {
      loadingPrograms.value = false;
    }
  }

  async function loadTemplates() {
    try {
      templates.value = await api().get<ProgramTemplate[]>('/api/programs/templates');
      writeJson(keys.value!.templates, templates.value);
    } catch { /* Vorlagen sind optional */ }
  }

  async function loadFavorites() {
    try {
      favorites.value = await api().get<number[]>('/api/favorites');
      writeJson(keys.value!.favorites, favorites.value);
    } catch (e) {
      if (isNetworkError(e)) online.value = false;
    }
  }

  async function loadProfile() {
    if (!online.value) return;
    try { profile.value = await api().get<Profile>('/api/auth/me'); } catch { /* optional */ }
  }

  function persistQueue() { if (keys.value) writeJson(keys.value.queue, queue.value); }
  function persistSession() {
    const s = session.value;
    if (keys.value) writeJson(keys.value.session, s.sets.length || s.order?.length || s.plan || s.editing ? s : null);
  }
  function persistTimer() { if (keys.value) writeJson(keys.value.timer, timer.value.endAt ? timer.value : null); }

  // =====================================================================
  // Synchronisation
  // =====================================================================
  // Sperre gegen parallele Läufe - aber mit Ablaufzeit: Hängt ein Lauf (iOS friert die WebView mitten im Request ein),
  // darf er die Queue nicht für immer blockieren. Ein neuerer Lauf übernimmt; das Ergebnis des alten wird verworfen.
  // Doppelte Sendungen sind harmlos: Der Server erkennt dieselbe clientId wieder.
  let syncRun = 0;
  let syncStartedAt = 0;

  async function syncNow({ reload = true } = {}) {
    if (!isAuthenticated.value || !queue.value.some((q) => q.status === QueueStatus.Pending)) return;
    if (syncing.value && Date.now() - syncStartedAt < SYNC_LOCK_MS) return;
    const run = ++syncRun;
    syncing.value = true;
    syncStartedAt = Date.now();
    const before = queue.value;
    try {
      const client = api();
      const result = await syncQueue(before, (payload, entry) => (isUpdate(entry)
        ? client.put(`/api/workouts/${entry.workoutId}`, payload)
        : client.post('/api/workouts', payload)));
      if (run !== syncRun || !isAuthenticated.value) return;
      // Einträge, die während des Syncs neu hinzugekommen sind, nicht verlieren.
      const added = queue.value.filter((q) => !before.includes(q));
      const syncedEntries = before.filter((q) => !result.queue.some((r) => r.clientId === q.clientId));
      queue.value = [...result.queue, ...added];
      persistQueue();

      if (result.synced > 0) online.value = true;
      if (result.stoppedBy === 'network') online.value = false;
      if (result.stoppedBy === 'auth') handleUnauthorized();
      const newlyFailed = result.queue.filter((q) => q.status === QueueStatus.Failed && !before.find((b) => b.clientId === q.clientId && b.status === QueueStatus.Failed));
      if (newlyFailed.length) toast(tn('finish.toast.rejected', newlyFailed.length, { error: newlyFailed[0].error ?? '' }), 'error');

      if (result.synced > 0) {
        const loaded = reload ? await loadHistory() : true;
        if (!loaded) {
          // Historie konnte nicht neu geladen werden - synchronisierte Einheiten trotzdem anzeigen.
          history.value = [...queueAsWorkouts(syncedEntries).map((w) => ({ ...w, pending: false })), ...history.value];
        }
      }
    } finally {
      if (run === syncRun) syncing.value = false;
    }
  }

  /**
   * Offene Einheiten bei jeder Gelegenheit senden. Bewusst NICHT an online.value gekoppelt: Das Flag kann nach
   * einem einzelnen Fehler (Funkloch im Gym) auf false stehen bleiben, ohne dass der Browser je ein 'online'-Event schickt.
   * Ein Versuch ohne Netz scheitert sofort und kostet nichts.
   */
  function kickSync() {
    if (isAuthenticated.value && pendingCount.value) void syncNow();
  }

  /**
   * Nach dem Speichern senden und ehrlich melden, wo die Einheit liegt: "gespeichert" erst, wenn der Server sie hat.
   * Scheitert das Senden (Funkloch), heißt es "auf dem Gerät gespeichert, wird automatisch synchronisiert".
   */
  async function syncAndAnnounce(clientId: string, savedMessage: string, offlineMessage: string) {
    if (!online.value) {
      toast(offlineMessage, 'success');
      await syncNow();
      return;
    }
    await syncNow();
    const entry = queue.value.find((q) => q.clientId === clientId);
    if (!entry) toast(savedMessage, 'success');
    else if (entry.status === QueueStatus.Pending) toast(offlineMessage, 'info');
    // Failed: syncNow hat die Ablehnung bereits gemeldet.
  }

  async function retryEntry(workout: Workout) {
    queue.value = queue.value.map((q) => (q.clientId === workout.clientId ? { ...q, status: QueueStatus.Pending, error: null } : q));
    persistQueue();
    await syncNow();
  }

  // =====================================================================
  // Favoriten / Übungsliste
  // =====================================================================
  async function toggleFavorite(ex: Exercise) {
    if (!online.value) { toast(t('favorites.needsConnection'), 'error'); return; }
    const isFav = favorites.value.includes(ex.id);
    favorites.value = isFav ? favorites.value.filter((id) => id !== ex.id) : [...favorites.value, ex.id];
    try {
      if (isFav) await api().del(`/api/favorites/${ex.id}`);
      else await api().post(`/api/favorites/${ex.id}`);
      writeJson(keys.value!.favorites, favorites.value);
    } catch (e) {
      toast(errorMessage(e), 'error');
      await loadFavorites();
    }
  }

  function toggleMuscleFilter(group: string) {
    muscleFilters.value = muscleFilters.value.includes(group)
      ? muscleFilters.value.filter((g) => g !== group)
      : [...muscleFilters.value, group];
  }

  function selectSort(mode: SortMode) { sortMode.value = mode; sortOpen.value = false; }

  function lastSetLabel(ex: Exercise): string {
    const last = lastSetFor(allWorkouts.value, `id:${ex.id}`);
    return last ? `${describeSet(last, ex.trackingType)} · ${formatRelative(last.date, clockDate.value)}` : '';
  }

  // =====================================================================
  // Satz erfassen
  // =====================================================================
  function planTargetFor(exerciseId: number | undefined | null): PlanTarget | null {
    return session.value.plan?.targets?.find((t) => t.exerciseId === exerciseId) ?? null;
  }

  function openSetModal(ex: Exercise, editIndex: number | null = null) {
    const sessionSets = session.value.sets.filter((s) => s.exerciseId === ex.id);
    const suggestion = planTargetFor(ex.id)?.suggestion;
    const fromPlan: WorkoutSet | null = suggestion && (suggestion.weight != null || suggestion.reps != null || suggestion.distance != null || suggestion.time != null)
      ? { weight: suggestion.weight ?? undefined, reps: suggestion.reps ?? undefined, distance: suggestion.distance ?? undefined, time: suggestion.time ?? undefined }
      : null;
    const source: WorkoutSet | null = editIndex !== null
      ? session.value.sets[editIndex]
      : sessionSets[sessionSets.length - 1] ?? fromPlan ?? lastSetFor(allWorkouts.value, `id:${ex.id}`);

    const type = ex.trackingType ?? TrackingType.WeightReps;
    setModal.value = {
      open: true,
      exercise: ex,
      editIndex,
      weight: source?.weight ?? (type === TrackingType.WeightReps && !(!ex.isCustom && BODYWEIGHT_EXERCISES.has(ex.id)) ? DEFAULTS.weight : 0),
      reps: source?.reps ?? (type === TrackingType.WeightReps ? DEFAULTS.reps : 0),
      distance: source?.distance ?? (type === TrackingType.DistanceTime ? DEFAULTS.distance : 0),
      time: source?.time ?? (type === TrackingType.Duration ? DEFAULTS.duration : type === TrackingType.DistanceTime ? DEFAULTS.time : 0),
      rpe: editIndex !== null ? source?.rpe ?? null : null,
      isWarmup: editIndex !== null ? !!source?.isWarmup : false,
      note: editIndex !== null ? source?.note ?? '' : '',
      showNote: editIndex !== null && !!source?.note,
    };
  }

  function closeSetModal() { setModal.value.open = false; }

  type StepField = 'weight' | 'reps' | 'distance' | 'time';
  function step(field: StepField, delta: number, min = 0, decimals = 2) {
    const value = Number(setModal.value[field]) || 0;
    const factor = 10 ** decimals;
    setModal.value[field] = Math.max(min, Math.round((value + delta) * factor) / factor);
  }

  function setWeightByPercentage(percent: number) {
    const pr = modalRecord.value?.maxWeight?.value ?? 0;
    if (pr > 0) setModal.value.weight = roundTo(pr * (percent / 100), 2.5);
  }

  function copyPrevious() {
    const p = modalPrevious.value;
    if (!p) return;
    Object.assign(setModal.value, { weight: p.weight ?? 0, reps: p.reps ?? 0, distance: p.distance ?? 0, time: p.time ?? 0 });
  }

  function buildSet(): { set: SessionSet; error?: undefined } | { set?: undefined; error: string } {
    const m = setModal.value;
    const ex = m.exercise!;
    const type = ex.trackingType ?? TrackingType.WeightReps;
    const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const set: SessionSet = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      trackingType: type,
      muscleGroup: ex.muscleGroup,
      category: ex.category,
      weight: null, reps: null, distance: null, time: null,
      rpe: m.rpe ?? null,
      isWarmup: !!m.isWarmup,
      note: m.note.trim().slice(0, 200) || null,
    };
    if (type === TrackingType.WeightReps) {
      set.weight = Math.max(0, num(m.weight));
      set.reps = Math.max(0, Math.round(num(m.reps)));
      if (set.reps < 1) return { error: t('set.errors.reps') };
      if (set.weight > 1000) return { error: t('set.errors.weight') };
    } else if (type === TrackingType.DistanceTime) {
      set.distance = Math.max(0, num(m.distance));
      set.time = Math.max(0, num(m.time));
      if (!(set.distance > 0) && !(set.time > 0)) return { error: t('set.errors.distanceTime') };
    } else {
      set.time = Math.max(0, num(m.time));
      if (!(set.time > 0)) return { error: t('set.errors.duration') };
    }
    return { set };
  }

  function saveSet() {
    unlockAudio();
    const result = buildSet();
    if (result.error !== undefined) { toast(result.error, 'error'); return; }
    const { set } = result;

    const wasPR = modalIsNewPR.value;
    const s = session.value;
    if (setModal.value.editIndex !== null) {
      s.sets.splice(setModal.value.editIndex, 1, set);
    } else {
      if (!s.startedAt || !s.sets.length) s.startedAt = new Date().toISOString();
      s.sets.push(set);
      const planRest = planTargetFor(set.exerciseId)?.restSeconds;
      if (settings.value.autoTimer && !isEditing.value) startTimer(planRest || (set.category === 'Football' ? settings.value.restField : settings.value.restGym));
      if (navigator.vibrate && settings.value.vibration) navigator.vibrate(15);
    }
    persistSession();
    closeSetModal();
    if (wasPR) toast(t('set.toast.record', { name: trExerciseName(set.exerciseId, set.exerciseName) }), 'gold');
  }

  function editSessionSet(index: number) {
    const set = session.value.sets[index];
    const ex: Exercise = exercisesById.value.get(set.exerciseId) ?? {
      id: set.exerciseId, name: set.exerciseName, category: set.category ?? 'Gym',
      muscleGroup: set.muscleGroup ?? null, trackingType: trackingOf(set),
    };
    showReview.value = false;
    openSetModal(ex, index);
  }

  function removeSessionSet(index: number) {
    const s = session.value;
    s.sets.splice(index, 1);
    if (!s.sets.length && !s.order?.length && !s.plan && !isEditing.value) { s.startedAt = null; showReview.value = false; }
    persistSession();
  }

  // =====================================================================
  // Laufende Einheit als Blöcke (ein Tipp pro Satz)
  // =====================================================================
  /** Übung aus dem Katalog - oder aus Satz-/Plan-Daten rekonstruiert (gelöschte eigene Übung, Katalog noch nicht geladen). */
  function exerciseFor(id: number): Exercise {
    const known = exercisesById.value.get(id);
    if (known) return known;
    const set = session.value.sets.find((x) => x.exerciseId === id);
    const target = session.value.plan?.targets.find((x) => x.exerciseId === id);
    return {
      id,
      name: set?.exerciseName ?? target?.exerciseName ?? '?',
      category: set?.category ?? target?.category ?? 'Gym',
      muscleGroup: set?.muscleGroup ?? target?.muscleGroup ?? null,
      trackingType: set?.trackingType ?? (target?.trackingType as TrackingTypeValue | undefined) ?? TrackingType.WeightReps,
    };
  }

  const editingExclude = computed(() => {
    const e = session.value.editing;
    return e ? (e.kind === 'server' ? { id: e.id, clientId: e.clientId } : { clientId: e.clientId }) : null;
  });

  /** Eingaben im Geister-Satz pro Übung, bevor ✓ gedrückt wird. */
  const ghostDraft = ref<Record<number, Partial<Pick<GhostValues, 'weight' | 'reps' | 'distance' | 'time' | 'isWarmup'>>>>({});

  const workoutBlocks = computed<WorkoutBlock[]>(() => {
    const s = session.value;
    const ids = blockOrder(s.order, (s.plan?.targets ?? []).map((x) => x.exerciseId), s.sets.map((x) => x.exerciseId));
    return ids.map((id) => {
      const exercise = exerciseFor(id);
      const sets = s.sets.map((x, index) => ({ ...x, index })).filter((x) => x.exerciseId === id);
      const target = planTargetFor(id);
      const previous = previousSets(allWorkouts.value, id, editingExclude.value);
      const ghost = ghostFor({
        trackingType: exercise.trackingType ?? TrackingType.WeightReps,
        bodyweight: !exercise.isCustom && BODYWEIGHT_EXERCISES.has(id),
        index: sets.length,
        sessionSets: sets,
        template: s.templates?.[id] ?? null,
        plan: target?.suggestion ?? null,
        previous,
      });
      return { exercise, sets, workingDone: sets.filter((x) => !x.isWarmup).length, target, previous, ghost: { ...ghost, ...ghostDraft.value[id] } };
    });
  });

  function ensureStarted() {
    if (!session.value.startedAt) session.value.startedAt = new Date().toISOString();
  }

  /** Übungen als Blöcke hinzufügen (ohne Satz). Startet die Einheit. */
  function addExercises(ids: readonly number[]) {
    const s = session.value;
    const order = blockOrder(s.order, (s.plan?.targets ?? []).map((x) => x.exerciseId), s.sets.map((x) => x.exerciseId));
    for (const id of ids) if (!order.includes(id)) order.push(id);
    s.order = order;
    ensureStarted();
    persistSession();
  }

  async function removeBlock(id: number) {
    const s = session.value;
    if (s.sets.some((x) => x.exerciseId === id)) {
      const ok = await confirm({ title: t('workout.confirm.removeTitle'), message: t('workout.confirm.removeMessage', { name: trExerciseName(exerciseFor(id)) }), confirmText: t('common.remove'), danger: true });
      if (!ok) return;
    }
    s.sets = s.sets.filter((x) => x.exerciseId !== id);
    s.order = (s.order ?? []).filter((x) => x !== id);
    if (s.plan) s.plan = { ...s.plan, targets: s.plan.targets.filter((x) => x.exerciseId !== id) };
    if (s.templates) delete s.templates[id];
    delete ghostDraft.value[id];
    if (!s.sets.length && !s.order.length && !s.plan && !isEditing.value) s.startedAt = null;
    persistSession();
  }

  function moveBlock(id: number, delta: -1 | 1) {
    const order = workoutBlocks.value.map((b) => b.exercise.id);
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    session.value.order = order;
    persistSession();
  }

  function setGhostValue(id: number, field: 'weight' | 'reps' | 'distance' | 'time', value: unknown) {
    const num = Number(String(value).replace(',', '.'));
    ghostDraft.value = { ...ghostDraft.value, [id]: { ...ghostDraft.value[id], [field]: Number.isFinite(num) ? Math.max(0, num) : 0 } };
  }

  function stepGhost(id: number, field: 'weight' | 'reps' | 'distance' | 'time', delta: number) {
    const block = workoutBlocks.value.find((b) => b.exercise.id === id);
    if (!block) return;
    const value = Math.max(0, Math.round((Number(block.ghost[field]) + delta) * 100) / 100);
    setGhostValue(id, field, value);
  }

  function toggleGhostWarmup(id: number) {
    const block = workoutBlocks.value.find((b) => b.exercise.id === id);
    if (!block) return;
    ghostDraft.value = { ...ghostDraft.value, [id]: { ...ghostDraft.value[id], isWarmup: !block.ghost.isWarmup } };
  }

  /** Prüft Werte eines Satzes; gibt eine Fehlermeldung zurück oder null. */
  function validateSet(set: SessionSet): string | null {
    if (set.trackingType === TrackingType.WeightReps) {
      if ((set.reps ?? 0) < 1) return t('set.errors.reps');
      if ((set.weight ?? 0) > 1000) return t('set.errors.weight');
    } else if (set.trackingType === TrackingType.DistanceTime) {
      if (!((set.distance ?? 0) > 0) && !((set.time ?? 0) > 0)) return t('set.errors.distanceTime');
    } else if (!((set.time ?? 0) > 0)) return t('set.errors.duration');
    return null;
  }

  function isNewRecord(set: SessionSet): boolean {
    const r = records.value.get(`id:${set.exerciseId}`);
    if (!r || set.isWarmup) return false;
    if (set.trackingType === TrackingType.WeightReps) return (r.maxWeight?.value ?? 0) > 0 && (set.weight ?? 0) > r.maxWeight!.value;
    if (set.trackingType === TrackingType.DistanceTime) {
      const speed = setSpeed({ distance: set.distance ?? 0, time: set.time ?? 0 });
      return (r.topSpeed?.value ?? 0) > 0 && speed > r.topSpeed!.value;
    }
    return (r.longest?.value ?? 0) > 0 && (set.time ?? 0) > r.longest!.value;
  }

  /** ✓ im Geister-Satz: Satz mit den angezeigten Werten loggen. */
  function quickLog(id: number) {
    unlockAudio();
    const block = workoutBlocks.value.find((b) => b.exercise.id === id);
    if (!block) return;
    const ex = block.exercise;
    const type = ex.trackingType ?? TrackingType.WeightReps;
    const g = block.ghost;
    const set: SessionSet = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      trackingType: type,
      muscleGroup: ex.muscleGroup,
      category: ex.category,
      weight: type === TrackingType.WeightReps ? g.weight : null,
      reps: type === TrackingType.WeightReps ? Math.round(g.reps) : null,
      distance: type === TrackingType.DistanceTime ? g.distance : null,
      time: type === TrackingType.WeightReps ? null : g.time,
      rpe: null,
      isWarmup: !!g.isWarmup,
      note: null,
    };
    const error = validateSet(set);
    if (error) { toast(error, 'error'); return; }
    const wasPR = isNewRecord(set);
    ensureStarted();
    session.value.sets.push(set);
    const { [id]: _done, ...rest } = ghostDraft.value;
    ghostDraft.value = rest;
    const planRest = block.target?.restSeconds;
    if (settings.value.autoTimer && !isEditing.value && !set.isWarmup) startTimer(planRest || (set.category === 'Football' ? settings.value.restField : settings.value.restGym));
    if (navigator.vibrate && settings.value.vibration) navigator.vibrate(15);
    persistSession();
    if (wasPR) toast(t('set.toast.record', { name: trExerciseName(set.exerciseId, set.exerciseName) }), 'gold');
  }

  // ---------- Übungsauswahl ----------
  const picker = ref({ open: false, query: '', filter: 'recent' as PickerFilter, category: 'Gym' as 'Gym' | 'Football', muscle: null as string | null, selected: [] as number[] });

  function openPicker() {
    picker.value = { open: true, query: '', filter: records.value.size ? 'recent' : 'all', category: tab.value === 'Football' ? 'Football' : 'Gym', muscle: null, selected: [] };
  }
  function togglePicked(id: number) {
    const sel = picker.value.selected;
    picker.value.selected = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
  }
  function confirmPicker() {
    const ids = picker.value.selected;
    picker.value.open = false;
    if (ids.length) addExercises(ids);
  }

  const pickerMuscles = computed(() => [...new Set(exercises.value.filter((e) => e.category === picker.value.category).map((e) => e.muscleGroup || 'Other'))].sort());

  const pickerResults = computed(() => {
    const p = picker.value;
    const inWorkout = new Set(workoutBlocks.value.map((b) => b.exercise.id));
    // Mit Suchbegriff: alle Kategorien durchsuchen (man weiß nicht immer, wo eine Übung einsortiert ist).
    if (normalize(p.query)) return searchExercises(p.query, exercises.value).slice(0, 60).map((e) => ({ e, inWorkout: inWorkout.has(e.id) }));
    let list = exercises.value.filter((e) => e.category === p.category);
    if (p.muscle) list = list.filter((e) => (e.muscleGroup || 'Other') === p.muscle);
    const last = (e: Exercise) => String(records.value.get(`id:${e.id}`)?.lastDate ?? '');
    if (p.filter === 'recent') list = list.filter((e) => last(e)).sort((a, b) => last(b).localeCompare(last(a)));
    else if (p.filter === 'favorites') list = list.filter((e) => favorites.value.includes(e.id));
    if (p.filter !== 'recent') list = [...list].sort((a, b) => trExerciseName(a).localeCompare(trExerciseName(b), intlLocale()));
    return list.map((e) => ({ e, inWorkout: inWorkout.has(e.id) }));
  });

  /** "+" im Katalog: Übung als Block in die Einheit (startet sie bei Bedarf). */
  function addFromCatalog(ex: Exercise) {
    addExercises([ex.id]);
    toast(t('workout.toast.added', { name: trExerciseName(ex) }), 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Leere Einheit starten: Übungsauswahl öffnen. */
  async function startWorkout() {
    openPicker();
  }

  /** Ergänzt Kategorie/Typ für Sätze aus Altdaten, sobald der Übungskatalog geladen ist. */
  function enrichSession() {
    if (!session.value.sets.length) return;
    session.value.sets = session.value.sets.map((s) => {
      const ex = exercisesById.value.get(s.exerciseId);
      return ex ? { ...s, category: s.category ?? ex.category, trackingType: s.trackingType ?? ex.trackingType, muscleGroup: s.muscleGroup ?? ex.muscleGroup } : s;
    });
    persistSession();
  }

  async function abortSession() {
    const ok = await confirm(isEditing.value
      ? { title: t('session.confirm.discardChangesTitle'), message: t('session.confirm.discardChangesMessage'), confirmText: t('session.discard'), danger: true }
      : { title: t('session.confirm.discardSessionTitle'), message: t('session.confirm.discardSessionMessage'), confirmText: t('session.discard'), danger: true });
    if (!ok) return;
    session.value = EMPTY_SESSION();
    ghostDraft.value = {};
    persistSession();
    stopTimer();
    showReview.value = false;
  }

  /** Schritt 1: Abschluss-Dialog (Session-RPE, Notiz, Datum, Dauer). */
  function finishSession() {
    if (!session.value.sets.length) return;
    const meta = session.value.meta;
    const startedAt = session.value.startedAt ?? new Date().toISOString();
    const elapsedMin = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
    finishModal.value = {
      open: true,
      sessionRpe: meta?.sessionRpe ?? null,
      quality: meta?.quality ?? null,
      notes: meta?.notes ?? '',
      date: toLocalInput(meta?.date ?? startedAt),
      durationMin: meta
        ? (meta.durationSeconds ? Math.round(meta.durationSeconds / 60) : null)
        : (elapsedMin > 0 && elapsedMin <= 1440 ? elapsedMin : null),
      error: '',
    };
    showReview.value = false;
  }

  /** Schritt 2: Einheit lokal sichern (Queue) und synchronisieren. */
  async function confirmFinish() {
    const f = finishModal.value;
    const s = session.value;
    const date = f.date ? new Date(f.date) : new Date(s.startedAt ?? Date.now());
    if (Number.isNaN(date.getTime())) { f.error = t('finish.errors.date'); return; }
    if (date.getTime() > Date.now() + 60 * 60 * 1000) { f.error = t('finish.errors.future'); return; }
    const minutes = Number(f.durationMin);
    const base = {
      date: date.toISOString(),
      durationSeconds: minutes > 0 && minutes <= 1440 ? Math.round(minutes * 60) : null,
      sessionRpe: f.sessionRpe ?? null,
      quality: f.quality ?? null,
      notes: f.notes?.trim() ? f.notes.trim().slice(0, 500) : null,
      programDayId: s.plan?.dayId ?? s.meta?.programDayId ?? null,
      workoutType: inferWorkoutType(s.sets),
      sets: s.sets.map((x) => ({ ...x })),
      status: QueueStatus.Pending,
      attempts: 0,
      error: null,
    };

    // 1. Immer zuerst lokal sichern (offline-first) ...
    const editing = s.editing;
    let saved: QueueEntry;
    if (editing?.kind === 'server') {
      saved = { ...base, op: 'update', workoutId: editing.id, clientId: editing.clientId ?? newClientId() };
      queue.value = [...queue.value.filter((q) => !(isUpdate(q) && q.workoutId === editing.id)), saved];
    } else if (editing?.kind === 'pending') {
      const existing = queue.value.find((q) => q.clientId === editing.clientId);
      saved = { ...base, op: existing?.op ?? 'create', workoutId: existing?.workoutId, clientId: editing.clientId };
      const entry = saved;
      queue.value = existing ? queue.value.map((q) => (q === existing ? entry : q)) : [...queue.value, entry];
    } else {
      saved = { ...base, clientId: newClientId() };
      queue.value = [...queue.value, saved];
    }
    persistQueue();

    session.value = EMPTY_SESSION();
    ghostDraft.value = {};
    persistSession();
    stopTimer();
    finishModal.value.open = false;
    tab.value = 'Data';
    dataTab.value = 'history';
    // 2. ... dann synchronisieren.
    await syncAndAnnounce(saved.clientId, t(editing ? 'finish.toast.updated' : 'finish.toast.saved'), t(editing ? 'finish.toast.updatedOffline' : 'finish.toast.savedOffline'));
  }

  /** Sätze einer Einheit in das Format der laufenden Session übernehmen. */
  function toSessionSets(sets: readonly WorkoutSet[], { keepDetails }: { keepDetails: boolean }): SessionSet[] {
    return sets.map((s) => {
      const ex = s.exerciseId != null ? exercisesById.value.get(s.exerciseId) : undefined;
      return {
        exerciseId: s.exerciseId!,
        exerciseName: s.exerciseName ?? s.name ?? '?',
        trackingType: s.trackingType ?? ex?.trackingType ?? trackingOf(s),
        muscleGroup: s.muscleGroup ?? ex?.muscleGroup,
        category: s.category ?? ex?.category,
        weight: s.weight, reps: s.reps, distance: s.distance, time: s.time,
        rpe: keepDetails ? s.rpe ?? null : null,
        isWarmup: !!s.isWarmup,
        note: keepDetails ? s.note ?? null : null,
      };
    });
  }

  async function repeatWorkout(workout: Workout) {
    if (sessionActive.value) {
      const ok = await confirm({ title: t('session.confirm.replaceTitle'), message: t('session.confirm.replaceRepeat'), confirmText: t('session.confirm.replace') });
      if (!ok) return;
    }
    // Als Vorlage laden: gleiche Übungen in gleicher Reihenfolge, jeder Satz steht vorausgefüllt bereit (✓ = erledigt).
    const planned = toSessionSets(workout.sets, { keepDetails: false });
    const templatesById: Record<number, WorkoutSet[]> = {};
    for (const x of planned) (templatesById[x.exerciseId] ??= []).push({ weight: x.weight, reps: x.reps, distance: x.distance, time: x.time, isWarmup: x.isWarmup });
    session.value = { ...EMPTY_SESSION(), startedAt: new Date().toISOString(), order: [...new Set(planned.map((x) => x.exerciseId))], templates: templatesById };
    ghostDraft.value = {};
    stopTimer();
    persistSession();
    tab.value = planned.some((x) => x.category === 'Gym') ? 'Gym' : 'Football';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Bestehende Einheit bearbeiten: wird in die Session geladen, "Finish" speichert per PUT (auch offline über die Queue). */
  async function editWorkout(workout: Workout) {
    if (!workout.pending && !workout.id) return;
    if (workout.workoutType === MATCH) { openMatchModal(workout); return; }
    if (sessionActive.value) {
      const ok = await confirm({ title: t('session.confirm.replaceTitle'), message: t('session.confirm.replaceEdit'), confirmText: t('common.edit') });
      if (!ok) return;
    }
    stopTimer();
    session.value = {
      startedAt: workout.date,
      sets: toSessionSets(workout.sets, { keepDetails: true }),
      editing: workout.pending ? { kind: 'pending', clientId: workout.clientId! } : { kind: 'server', id: workout.id!, clientId: workout.clientId },
      meta: { date: workout.date, durationSeconds: workout.durationSeconds, sessionRpe: workout.sessionRpe, quality: workout.quality ?? null, notes: workout.notes, programDayId: workout.programDayId ?? null },
      plan: null,
    };
    persistSession();
    const sets = session.value.sets;
    tab.value = sets.some((s) => s.category === 'Football') && !sets.some((s) => s.category === 'Gym') ? 'Football' : 'Gym';
    // Bearbeiten passiert direkt in den Übungs-Blöcken (WorkoutView) - kein extra Dialog.
    showReview.value = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteWorkout(workout: Workout) {
    if (workout.pending) {
      const ok = await confirm(workout.op === 'update'
        ? { title: t('history.confirm.discardChangesTitle'), message: t('history.confirm.discardChangesMessage'), confirmText: t('session.discard'), danger: true }
        : { title: t('history.confirm.discardTitle'), message: t('history.confirm.discardMessage'), confirmText: t('session.discard'), danger: true });
      if (!ok) return;
      queue.value = queue.value.filter((q) => q.clientId !== workout.clientId);
      persistQueue();
      return;
    }
    if (!online.value) { toast(t('history.toast.needsConnection'), 'error'); return; }
    const ok = await confirm({
      title: t('history.confirm.deleteTitle'),
      message: t('history.confirm.deleteMessage', { date: formatDate(workout.date), sets: tn('units.sets', workout.sets.length) }),
      confirmText: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api().del(`/api/workouts/${workout.id}`);
      history.value = history.value.filter((w) => w.id !== workout.id);
      writeJson(keys.value!.history, history.value);
      toast(t('history.toast.deleted'), 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  // =====================================================================
  // Trainingspläne
  // =====================================================================
  // =====================================================================
  // Export nach Obsidian (Dialog in ObsidianModal.vue)
  // =====================================================================
  const obsidianWorkout = ref<Workout | null>(null);
  function openObsidian(workout: Workout) { obsidianWorkout.value = workout; }

  // =====================================================================
  // Spiele (Match): ohne Sätze, Last = Minuten × Session-RPE
  // =====================================================================
  const matchModal = ref({
    open: false, editing: null as Editing | null, date: '', minutes: 90 as number | null, rpe: null as number | null, quality: null as number | null,
    goals: null as number | null, assists: null as number | null, opponent: '', notes: '', error: '',
  });

  function openMatchModal(workout?: Workout) {
    matchModal.value = workout
      ? {
          open: true,
          editing: workout.pending ? { kind: 'pending', clientId: workout.clientId! } : { kind: 'server', id: workout.id!, clientId: workout.clientId },
          date: toLocalInput(workout.date), minutes: workout.durationSeconds ? Math.round(workout.durationSeconds / 60) : 90,
          rpe: workout.sessionRpe ?? null, quality: workout.quality ?? null, goals: workout.match?.goals ?? null, assists: workout.match?.assists ?? null,
          opponent: workout.match?.opponent ?? '', notes: workout.notes ?? '', error: '',
        }
      : { open: true, editing: null, date: toLocalInput(new Date()), minutes: 90, rpe: null, quality: null, goals: null, assists: null, opponent: '', notes: '', error: '' };
  }

  async function saveMatch() {
    const m = matchModal.value;
    const date = new Date(m.date);
    if (Number.isNaN(date.getTime())) { m.error = t('finish.errors.date'); return; }
    if (date.getTime() > Date.now() + 60 * 60 * 1000) { m.error = t('finish.errors.future'); return; }
    const minutes = Number(m.minutes);
    if (!(minutes > 0 && minutes <= 180)) { m.error = t('match.errors.minutes'); return; }
    if (!m.rpe) { m.error = t('match.errors.rpe'); return; }
    const count = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(20, Math.round(Number(v)))));
    const base = {
      date: date.toISOString(),
      durationSeconds: Math.round(minutes * 60),
      sessionRpe: m.rpe,
      quality: m.quality ?? null,
      notes: m.notes.trim() ? m.notes.trim().slice(0, 500) : null,
      programDayId: null,
      workoutType: MATCH,
      sets: [] as WorkoutSet[],
      match: { goals: count(m.goals), assists: count(m.assists), opponent: m.opponent.trim().slice(0, 60) || null },
      status: QueueStatus.Pending,
      attempts: 0,
      error: null,
    };
    const editing = m.editing;
    let saved: QueueEntry;
    if (editing?.kind === 'server') {
      saved = { ...base, op: 'update', workoutId: editing.id, clientId: editing.clientId ?? newClientId() };
      queue.value = [...queue.value.filter((q) => !(isUpdate(q) && q.workoutId === editing.id)), saved];
    } else if (editing?.kind === 'pending') {
      const existing = queue.value.find((q) => q.clientId === editing.clientId);
      saved = { ...base, op: existing?.op ?? 'create', workoutId: existing?.workoutId, clientId: editing.clientId };
      const entry = saved;
      queue.value = existing ? queue.value.map((q) => (q === existing ? entry : q)) : [...queue.value, entry];
    } else {
      saved = { ...base, clientId: newClientId() };
      queue.value = [...queue.value, saved];
    }
    persistQueue();
    m.open = false;
    tab.value = 'Data';
    dataTab.value = 'history';
    await syncAndAnnounce(saved.clientId, t(editing ? 'finish.toast.updated' : 'match.toast.saved'), t(editing ? 'finish.toast.updatedOffline' : 'finish.toast.savedOffline'));
  }

  // =====================================================================
  // Tägliches Befinden (Wellness) - lokal zuerst, dann PUT pro Tag
  // =====================================================================
  const wellness = ref<WellnessEntry[]>([]);
  const checkIn = ref({ open: false, date: localDay(), sleep: 3, energy: 3, soreness: 3, mood: 3, sleepHours: null as number | null, note: '', busy: false });
  const todayWellness = computed(() => wellness.value.find((w) => w.date === localDay(clockDate.value)) ?? null);
  const readinessToday = computed(() => readiness(todayWellness.value));
  const readinessWeek = computed(() => weeklyAverage(wellness.value, clockDate.value));
  const readinessDays = computed(() => readinessTrend(wellness.value, 14, clockDate.value));
  const readinessHint = computed(() => readinessAdvice(readinessToday.value, loadInfo.value.zone));

  function persistWellness() { if (keys.value) writeJson(keys.value.wellness, wellness.value); }

  async function loadWellness() {
    if (!keys.value) return;
    wellness.value = readJson<WellnessEntry[]>(keys.value.wellness, []);
    if (!online.value) return;
    try {
      await pushPendingWellness();
      const fresh = await api().get<WellnessEntry[]>('/api/wellness?days=56');
      const pending = wellness.value.filter((w) => w.pending);
      wellness.value = [...pending, ...fresh.filter((f) => !pending.some((p) => p.date === f.date))].sort((a, b) => b.date.localeCompare(a.date));
      persistWellness();
    } catch (e) {
      if (!isNetworkError(e)) console.warn('[wellness] load failed', e);
    }
  }

  async function pushPendingWellness() {
    for (const entry of wellness.value.filter((w) => w.pending)) {
      const { date, pending: _pending, updatedAt: _updated, ...body } = entry;
      try {
        await api().put(`/api/wellness/${date}`, body);
        entry.pending = false;
      } catch (e) {
        if (isNetworkError(e)) return;
        throw e;
      }
    }
    persistWellness();
  }

  function openCheckIn() {
    const today = todayWellness.value;
    checkIn.value = {
      open: true, date: localDay(clockDate.value), busy: false,
      sleep: today?.sleep ?? 3, energy: today?.energy ?? 3, soreness: today?.soreness ?? 3, mood: today?.mood ?? 3,
      sleepHours: today?.sleepHours ?? null, note: today?.note ?? '',
    };
  }

  function setWellnessValue(field: WellnessField, value: number) { checkIn.value[field] = value; }

  async function saveCheckIn() {
    const c = checkIn.value;
    const hours = c.sleepHours == null || (c.sleepHours as unknown) === '' ? null : Math.max(0, Math.min(24, Number(c.sleepHours)));
    const entry: WellnessEntry = {
      date: c.date, sleep: c.sleep, energy: c.energy, soreness: c.soreness, mood: c.mood,
      sleepHours: Number.isFinite(hours) ? hours : null, note: c.note.trim().slice(0, 200) || null, pending: true,
    };
    wellness.value = [entry, ...wellness.value.filter((w) => w.date !== entry.date)];
    persistWellness();
    c.open = false;
    toast(t('wellness.toast.saved'), 'success');
    if (online.value) {
      try { await pushPendingWellness(); } catch (e) { toast(errorMessage(e), 'error'); }
    }
  }

  const progressInPlan = computed(() => programProgress(activeProgram.value, allWorkouts.value, clockDate.value));

  function dayLabel(day: ProgramDay): string {
    const last = programInfo.value?.lastByDay.get(day.id);
    return last ? t('plan.lastRelative', { when: formatRelative(last, clockDate.value) }) : t('plan.notDone');
  }

  function programNameForDay(dayId: number): string | null {
    for (const p of programs.value) {
      const day = p.days.find((d) => d.id === dayId);
      if (day) return `${trProgramName(p)} · ${trDayName(p, day)}`;
    }
    return null;
  }

  /** Plan-Tag starten: Session mit Zielvorgaben und Gewichtsvorschlägen (Double Progression). */
  async function startProgramDay(day: ProgramDay) {
    if (sessionActive.value) {
      const ok = await confirm({ title: t('plan.confirm.replaceTitle'), message: t('plan.confirm.replaceDay'), confirmText: t('plan.confirm.startDay') });
      if (!ok) return;
    }
    const targets: PlanTarget[] = day.exercises.map((x) => {
      const px = currentPrescription(x);
      return {
        ...px,
        name: x.exerciseName,
        category: exercisesById.value.get(x.exerciseId)?.category ?? 'Gym',
        suggestion: suggestTarget(px, allWorkouts.value, clockDate.value),
      };
    });
    stopTimer();
    session.value = {
      ...EMPTY_SESSION(),
      startedAt: new Date().toISOString(),
      plan: { programId: activeProgram.value?.id, programName: activeProgram.value?.name, dayId: day.id, dayName: day.name, targets },
    };
    persistSession();
    tab.value = targets[0]?.category === 'Football' ? 'Football' : 'Gym';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(t('plan.toast.dayStarted', { name: trDayName(activeProgram.value, day) }), 'success');
  }

  function openPlanTarget(target: PlanTarget) {
    const ex: Exercise = exercisesById.value.get(target.exerciseId) ?? {
      id: target.exerciseId, name: target.exerciseName ?? '?', category: target.category,
      muscleGroup: target.muscleGroup ?? null, trackingType: target.trackingType ?? 'WeightReps',
    };
    if (ex.category && tab.value !== 'Plan' && ex.category !== tab.value) tab.value = ex.category as Tab;
    openSetModal(ex);
  }

  async function startTemplate(template: ProgramTemplate) {
    if (!online.value) { toast(t('plan.toast.needsConnection'), 'error'); return; }
    if (activeProgram.value) {
      const ok = await confirm({ title: t('plan.confirm.switchTitle'), message: t('plan.confirm.switchMessage', { name: trProgramName(activeProgram.value) }), confirmText: t('common.start') });
      if (!ok) return;
    }
    try {
      await api().post(`/api/programs/templates/${encodeURIComponent(template.key)}`);
      await loadPrograms();
      toast(t('plan.toast.started', { name: templateText(template.key, 'name', template.name) }), 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function activateProgram(program: TrainingProgram) {
    if (!online.value) { toast(t('common.needsConnection'), 'error'); return; }
    try {
      await api().post(`/api/programs/${program.id}/activate`);
      await loadPrograms();
      toast(t('plan.toast.activated', { name: trProgramName(program) }), 'success');
    } catch (e) { toast(errorMessage(e), 'error'); }
  }

  async function stopProgram(program: TrainingProgram) {
    const ok = await confirm({ title: t('plan.confirm.pauseTitle'), message: t('plan.confirm.pauseMessage'), confirmText: t('plan.pause') });
    if (!ok) return;
    try {
      await api().post(`/api/programs/${program.id}/deactivate`);
      await loadPrograms();
    } catch (e) { toast(errorMessage(e), 'error'); }
  }

  async function deleteProgram(program: TrainingProgram | undefined) {
    if (!program) return;
    const ok = await confirm({ title: t('plan.confirm.deleteTitle'), message: t('plan.confirm.deleteMessage', { name: trProgramName(program) }), confirmText: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      await api().del(`/api/programs/${program.id}`);
      programs.value = programs.value.filter((p) => p.id !== program.id);
      writeJson(keys.value!.programs, programs.value);
      programEditor.value.open = false;
      toast(t('plan.toast.deleted'), 'success');
      void loadHistory(); // Einheiten verlieren die Verknüpfung
    } catch (e) { toast(errorMessage(e), 'error'); }
  }

  // ---------- Plan-Editor ----------
  function openProgramEditor(program: TrainingProgram | null = null) {
    if (!online.value) { toast(t('plan.toast.needsConnection'), 'error'); return; }
    programEditor.value = { open: true, draft: program ? toDraft(program) : emptyProgramDraft(), busy: false, error: '' };
  }
  function addDay() {
    const days = programEditor.value.draft.days;
    if (days.length >= 7) return;
    days.push({ id: null, name: `Day ${String.fromCharCode(65 + days.length)}`, notes: '', exercises: [] });
  }
  function removeDay(index: number) { programEditor.value.draft.days.splice(index, 1); }
  function addExerciseRow(day: DraftDay) {
    if (day.exercises.length >= 15) return;
    day.exercises.push(emptyDraftRow());
  }
  function removeExerciseRow(day: DraftDay, index: number) { day.exercises.splice(index, 1); }
  function moveExerciseRow(day: DraftDay, index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= day.exercises.length) return;
    const [row] = day.exercises.splice(index, 1);
    day.exercises.splice(to, 0, row);
  }
  function rowType(row: DraftExercise): TrackingTypeValue {
    return exercisesById.value.get(Number(row.exerciseId))?.trackingType ?? 'WeightReps';
  }

  async function saveProgram() {
    const ed = programEditor.value;
    ed.error = '';
    const payload = draftToPayload(ed.draft, exercisesById.value);
    if (payload.name.length < 2) { ed.error = t('editor.errors.name'); return; }
    const emptyDay = payload.days.find((d) => !d.exercises.length);
    if (emptyDay) { ed.error = t('editor.errors.emptyDay', { name: emptyDay.name }); return; }
    ed.busy = true;
    try {
      if (ed.draft.id) await api().put(`/api/programs/${ed.draft.id}`, payload);
      else await api().post('/api/programs', payload);
      await loadPrograms();
      ed.open = false;
      toast(t('plan.toast.saved'), 'success');
    } catch (e) {
      ed.error = errorMessage(e);
    } finally {
      ed.busy = false;
    }
  }

  // =====================================================================
  // Eigene Übungen
  // =====================================================================
  /** @param name vorbelegter Name; mit Name aus der Übungsauswahl wird die neue Übung direkt zur Einheit hinzugefügt. */
  function openCustomModal(name?: string) {
    if (!online.value) { toast(t('custom.toast.needsConnection'), 'error'); return; }
    const fromPicker = typeof name === 'string';
    customModal.value = {
      open: true,
      addToWorkout: fromPicker,
      name: fromPicker ? name : search.value.trim(),
      category: tab.value === 'Football' ? 'Football' : 'Gym',
      muscleGroup: muscleFilters.value[0] ?? '',
      trackingType: tab.value === 'Football' ? TrackingType.DistanceTime : TrackingType.WeightReps,
      busy: false,
      error: '',
    };
  }

  async function saveCustomExercise() {
    const m = customModal.value;
    m.error = '';
    if (m.name.trim().length < 2) { m.error = t('custom.errors.name'); return; }
    m.busy = true;
    try {
      const created = await api().post<Exercise>('/api/exercises', {
        name: m.name.trim(), category: m.category, muscleGroup: m.muscleGroup.trim() || null, trackingType: m.trackingType,
      });
      exercises.value = [...exercises.value, created];
      writeJson(keys.value!.exercises, exercises.value);
      m.open = false;
      search.value = '';
      tab.value = created.category as Tab;
      toast(t('custom.toast.created', { name: created.name }), 'success');
      if (m.addToWorkout) addExercises([created.id]);
      else openSetModal(created);
    } catch (e) {
      m.error = errorMessage(e);
    } finally {
      m.busy = false;
    }
  }

  async function deleteCustomExercise(ex: Exercise) {
    const ok = await confirm({ title: t('custom.confirm.title'), message: t('custom.confirm.message', { name: ex.name }), confirmText: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      await api().del(`/api/exercises/${ex.id}`);
      exercises.value = exercises.value.filter((e) => e.id !== ex.id);
      favorites.value = favorites.value.filter((id) => id !== ex.id);
      writeJson(keys.value!.exercises, exercises.value);
      closeSetModal();
      toast(t('custom.toast.deleted'), 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  // =====================================================================
  // Pausentimer
  // =====================================================================
  function startTimer(seconds: number) {
    timer.value = { endAt: Date.now() + seconds * 1000, duration: seconds };
    persistTimer();
  }
  function adjustTimer(delta: number) {
    if (!timer.value.endAt) return;
    timer.value = { endAt: timer.value.endAt + delta * 1000, duration: Math.max(1, timer.value.duration + delta) };
    persistTimer();
    checkTimer();
  }
  function stopTimer() {
    timer.value = { endAt: null, duration: 0 };
    persistTimer();
  }
  function checkTimer() {
    if (!timer.value.endAt || Date.now() < timer.value.endAt) return;
    const lateBy = Date.now() - timer.value.endAt;
    stopTimer();
    // Alarm nur, wenn das Ende "live" erlebt wurde (nicht nach Stunden im Hintergrund).
    if (lateBy < 60_000) {
      playRestAlarm({ sound: settings.value.sound, vibration: settings.value.vibration });
      toast(t('timer.over'), 'success');
    }
  }

  function updateWakeLock() {
    void wakeLock.set(settings.value.wakeLock && sessionActive.value);
  }

  // =====================================================================
  // Auswertungen
  // =====================================================================
  function selectDefaultProgress() {
    // Meistgeloggte Übung vorauswählen
    const top = [...records.value.values()].sort((a, b) => b.sessions - a.sessions)[0];
    if (top) progress.value.key = top.key;
  }

  function openProgress(key: string) {
    tab.value = 'Data';
    dataTab.value = 'progress';
    progress.value.key = key;
  }

  function setBadges(workout: Workout, index: number) {
    return prInfo.value.badges.get(`${workoutKey(workout)}#${index}`) ?? [];
  }

  // =====================================================================
  // Einstellungen / Konto
  // =====================================================================
  function openSettings() {
    settingsOpen.value = true;
    deleteAccount.value = { open: false, password: '', busy: false, error: '' };
    openSecurity('');
    void loadProfile();
    void loadAuthOptions();
  }

  function exportData(format: 'csv' | 'json') {
    if (!allWorkouts.value.length) { toast(t('settings.nothingToExport'), 'error'); return; }
    if (format === 'csv') exportCsv(user.value!.username, allWorkouts.value);
    else exportJson(user.value!.username, allWorkouts.value);
  }

  async function confirmDeleteAccount() {
    const d = deleteAccount.value;
    d.error = '';
    if (!d.password) { d.error = t('settings.errors.password'); return; }
    d.busy = true;
    try {
      await api().del('/api/auth/account', { password: d.password });
      if (keys.value) Object.values(keys.value).forEach(remove);
      toast(t('settings.toast.accountDeleted'), 'success');
      clearAuth();
    } catch (e) {
      d.error = errorMessage(e);
    } finally {
      d.busy = false;
    }
  }

  // =====================================================================
  // Service Worker (Offline + Update-Hinweis)
  // =====================================================================
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    // Nur neu laden, wenn der Nutzer das Update bestätigt hat (nicht bei der allerersten Installation).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadOnControllerChange) window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) updateWorker.value = registration.waiting;
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) updateWorker.value = worker;
        });
      });
      // Beim Zurückkehren in die App nach Updates suchen.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    }).catch((e: unknown) => console.warn('[sw] registration failed', e));
  }

  function applyUpdate() {
    if (!updateWorker.value) return;
    reloadOnControllerChange = true;
    updateWorker.value.postMessage({ type: 'SKIP_WAITING' });
  }

  // =====================================================================
  // Layer (Dialoge) schließen
  // =====================================================================
  function closeTopLayer() {
    if (ui.dialog.open) return ui.resolveDialog(false);
    if (finishModal.value.open) { finishModal.value.open = false; return; }
    if (programEditor.value.open) { programEditor.value.open = false; return; }
    if (setModal.value.open) return closeSetModal();
    if (customModal.value.open) { customModal.value.open = false; return; }
    if (obsidianWorkout.value) { obsidianWorkout.value = null; return; }
    if (showReview.value) { showReview.value = false; return; }
    if (settingsOpen.value) { settingsOpen.value = false; return; }
    if (sortOpen.value) sortOpen.value = false;
  }

  function closeAllLayers() {
    if (ui.dialog.open) ui.resolveDialog(false);
    setModal.value.open = false;
    customModal.value.open = false;
    finishModal.value.open = false;
    programEditor.value.open = false;
    showReview.value = false;
    settingsOpen.value = false;
    sortOpen.value = false;
  }

  // =====================================================================
  // Watcher + Start
  // =====================================================================
  watch(settings, (value) => { writeJson(Keys.settings, value); updateWakeLock(); }, { deep: true });
  watch(sessionActive, updateWakeLock);
  watch(dataTab, (value) => { if (value === 'progress' && !progress.value.key) selectDefaultProgress(); });
  watch(tab, (value) => {
    muscleFilters.value = [];
    if (value === 'Plan' && online.value) void loadPrograms();
    if (value === 'Data' && online.value) void loadHistory();
  });
  watch(() => progress.value.key, () => { progress.value.metric = progressMetrics.value[0]?.key ?? ''; });

  let started = false;
  /** Einmalig beim Mount der App: Listener, Takte, Service Worker, gespeicherte Anmeldung. */
  async function init() {
    if (started) return;
    started = true;
    settings.value = { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(Keys.settings, {}) };

    window.addEventListener('online', () => { online.value = true; void refreshAll(); });
    window.addEventListener('offline', () => { online.value = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        now.value = Date.now();
        clock.value = Date.now();
        kickSync();
      }
    });
    // In-App-Browser (Telegram, Instagram) und iOS melden das Zurückkehren nicht immer per visibilitychange.
    window.addEventListener('pageshow', kickSync);
    window.addEventListener('focus', kickSync);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopLayer(); });

    setInterval(() => { now.value = Date.now(); checkTimer(); }, 500);
    setInterval(() => { clock.value = Date.now(); }, 60_000);
    // Hintergrund-Sync jede Minute, falls etwas offen ist.
    setInterval(kickSync, 60_000);

    registerServiceWorker();

    handleLinkParams();

    // Angemeldet ist, wer einen gespeicherten Nutzer hat (Cookies sind für JS unsichtbar).
    // Ältere App-Versionen: Nutzer aus dem alten Token lesen - der Token wird beim Refresh gegen Cookies getauscht.
    const storedUser = readJson<AuthUser>(Keys.user);
    const legacy = readLegacyToken();
    const decoded = legacy ? decodeToken(legacy) : null;
    const restored = storedUser?.userId ? storedUser : decoded?.userId ? { userId: decoded.userId, username: decoded.username ?? '' } : null;
    if (restored) {
      user.value = restored;
      hydrate();
      booting.value = false;
      await refreshAll({ refreshToken: true });
      return;
    }
    removeLegacyToken();
    booting.value = false;
    void loadAuthOptions();
  }

  /** Links aus E-Mails: ?reset=<token> (neues Passwort) und ?verify=<token> (Adresse bestätigen). */
  function handleLinkParams() {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset');
    const verify = params.get('verify');
    if (!reset && !verify) return;
    window.history.replaceState(null, '', window.location.pathname); // Token nicht in der Adresszeile/History lassen
    if (reset) {
      resetToken.value = reset;
      setAuthMode('reset');
    }
    if (verify) {
      api().post('/api/auth/email/verify', { token: verify })
        .then(() => { toast(t('auth.toast.emailConfirmed'), 'success'); if (isAuthenticated.value) void loadProfile(); })
        .catch((e: unknown) => toast(isNetworkError(e) ? t('auth.toast.openLinkOnline') : errorMessage(e), 'error'));
    }
  }

  // =====================================================================
  // Konto-Sicherheit (Einstellungen)
  // =====================================================================
  function openSecurity(section: 'password' | 'email' | 'codes' | '') {
    security.value = { section, current: '', next: '', email: profile.value?.email ?? '', busy: false, error: '', notice: '' };
  }

  async function securityAction(run: () => Promise<string | void>) {
    const s = security.value;
    s.error = '';
    s.notice = '';
    if (!online.value) { s.error = t('common.needsConnection'); return; }
    s.busy = true;
    try {
      const notice = await run();
      if (notice) s.notice = notice;
      await loadProfile();
    } catch (e) {
      s.error = errorMessage(e);
    } finally {
      s.busy = false;
    }
  }

  const changePassword = () => securityAction(async () => {
    const s = security.value;
    if (s.next.length < 8) throw new Error(t('security.errors.passwordShort'));
    await api().post('/api/auth/password', { currentPassword: s.current, newPassword: s.next });
    s.current = '';
    s.next = '';
    s.section = '';
    toast(t('security.toast.passwordChanged'), 'success');
  });

  const saveEmail = (remove = false) => securityAction(async () => {
    const s = security.value;
    await api().put('/api/auth/email', { email: remove ? '' : s.email, password: s.current });
    s.current = '';
    if (remove) { s.section = ''; toast(t('security.toast.emailRemoved'), 'success'); return; }
    return t('security.emailSent', { email: s.email.trim().toLowerCase() });
  });

  const regenerateRecoveryCodes = () => securityAction(async () => {
    const s = security.value;
    const result = await api().post<{ codes: string[] }>('/api/auth/recovery-codes', { password: s.current });
    s.current = '';
    s.section = '';
    recoveryCodes.value = result.codes;
  });

  async function logoutEverywhere() {
    const ok = await confirm({ title: t('security.confirm.title'), message: t('security.confirm.message'), confirmText: t('security.confirm.action'), danger: true });
    if (!ok) return;
    try {
      await api().post('/api/auth/logout-all');
      settingsOpen.value = false;
      clearAuth();
      toast(t('security.toast.loggedOutAll'), 'success');
    } catch (e) { toast(errorMessage(e), 'error'); }
  }

  function dismissRecoveryCodes() { recoveryCodes.value = null; }

  return {
    // Zustand
    user, authMode, authForm, authBusy, authError, authFields, authNotice, authOptions, resetToken, recoveryCodes, booting, security,
    online, syncing, updateWorker,
    exercises, history, favorites, queue, loadingExercises, loadingHistory, programs, templates, loadingPrograms, programEditor, expandedDay,
    tab, dataTab, search, sortMode, sortOpen, muscleFilters,
    session, showReview, finishModal, setModal, customModal,
    settingsOpen, settings, profile, deleteAccount,
    timer, now, clock,
    historyFilter, historyLimit, progress, weeklyMetric, selectedDay,
    // Abgeleitet
    isAuthenticated, keys, exercisesById, allWorkouts, records, prInfo, usage, clockDate,
    activeProgram, otherPrograms, programInfo, loadInfo, loadZone, planTargets, planProgress, exerciseGroups,
    planWeek, isDeloadNow, currentPrescription, templateFilter, filteredTemplates,
    matchModal, openMatchModal, saveMatch, wellness, checkIn, todayWellness, readinessToday, readinessWeek, readinessDays, readinessHint,
    loadWellness, openCheckIn, setWellnessValue, saveCheckIn, progressInPlan,
    pendingCount, failedCount, syncState,
    categoryExercises, availableMuscleGroups, allMuscleGroups, filteredExercises, sortLabel,
    sessionActive, hasSets, isEditing, finishLoad, sessionElapsed, sessionGroups, sessionSummary,
    workoutBlocks, ghostDraft, picker, obsidianWorkout, openObsidian, pickerResults, pickerMuscles, searchExercises,
    addExercises, removeBlock, moveBlock, setGhostValue, stepGhost, toggleGhostWarmup, quickLog, openPicker, togglePicked, addFromCatalog, confirmPicker, startWorkout, exerciseFor,
    modalEx, modalType, modalKey, modalRecord, modalPrevious, modalSessionSets, modalTechnique, modalTarget, modalE1RM, modalIntensity,
    modalZone, modalSpeed, modalSpeedVsBest, modalIsNewPR,
    timerActive, timerLeft, timerProgress,
    weekly, kpis, muscleSplit, recentPRs, filteredHistory, visibleHistory,
    progressOptions, progressRecord, progressMetrics, progressMetric, progressSeries, progressDelta,
    recordList, heatmap, selectedDayWorkouts, activeDaysLast30,
    // Aktionen
    init, api, submitAuth, toggleAuthMode, setAuthMode, loadAuthOptions, fieldError, logout, clearAuth, refreshAll,
    openSecurity, changePassword, saveEmail, regenerateRecoveryCodes, logoutEverywhere, dismissRecoveryCodes,
    loadExercises, loadHistory, loadPrograms, loadTemplates, loadFavorites, loadProfile,
    syncNow, retryEntry, toggleFavorite, toggleMuscleFilter, selectSort, lastSetLabel,
    planTargetFor, openSetModal, closeSetModal, step, setWeightByPercentage, copyPrevious, saveSet,
    editSessionSet, removeSessionSet, abortSession, finishSession, confirmFinish, repeatWorkout, editWorkout, deleteWorkout,
    dayLabel, programNameForDay, startProgramDay, openPlanTarget, startTemplate, activateProgram, stopProgram, deleteProgram,
    openProgramEditor, addDay, removeDay, addExerciseRow, removeExerciseRow, moveExerciseRow, rowType, saveProgram,
    openCustomModal, saveCustomExercise, deleteCustomExercise,
    startTimer, adjustTimer, stopTimer, openProgress, setBadges,
    openSettings, exportData, confirmDeleteAccount, applyUpdate, closeTopLayer,
  };
});

// Kleine Anzeige-Helfer ohne Zustand - in Komponenten direkt importierbar.
export function trackingLabel(type: TrackingTypeValue): string {
  return ({ WeightReps: 'Weight × Reps', DistanceTime: 'Distance + Time', Duration: 'Duration' } as const)[type] ?? type;
}
export function setLabel(sets: readonly WorkoutSet[], n: number): string {
  if (sets[n]?.isWarmup) return t('history.warmupShort');
  return t('history.setLabel', { n: sets.slice(0, n + 1).filter((x) => !x.isWarmup).length });
}
/** Anstrengung eines Satzes: "@8" (RPE) oder "RIR 2" - gespeichert wird immer RPE. */
export const rpeText = (value: number | null | undefined, useRir = false) =>
  value ? (useRir ? t('history.rir', { value: formatNumber(Math.max(0, 10 - value), 1) }) : `@${formatNumber(value, 1)}`) : '';
/** RIR (Wdh. in Reserve) <-> RPE: RIR 2 = RPE 8. */
export const rpeToRir = (rpe: number) => Math.max(0, 10 - rpe);
export const sessionRpeLabel = (value: number | null | undefined) => (SESSION_RPE.some((r) => r.value === value) ? tDynamic(`rpe.${value}`, '') : '');
export function zoneClass(tone: string): string {
  return ({
    green: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    orange: 'text-orange-300 border-orange-400/30 bg-orange-400/10',
    red: 'text-red-400 border-red-500/40 bg-red-500/10',
    blue: 'text-accent border-accent/30 bg-accent/10',
  } as Record<string, string>)[tone] ?? 'text-slate-400 border-white/10 bg-white/5';
}
export function badgeClass(tone: string): string {
  return ({
    gold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    orange: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    green: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  } as Record<string, string>)[tone] ?? 'text-accent bg-accent/10 border-accent/30';
}
export function toastClass(tone: string): string {
  return ({
    success: 'border-emerald-400/40 text-emerald-300',
    error: 'border-red-400/40 text-red-300',
    gold: 'border-yellow-400/50 text-yellow-300',
  } as Record<string, string>)[tone] ?? 'border-accent/40 text-accent';
}
export function workoutStats(workout: Workout): string {
  if (workout.workoutType === MATCH) {
    const minutes = Math.round((workout.durationSeconds ?? 0) / 60);
    return t('match.summary', { minutes, rpe: workout.sessionRpe ?? '-', load: workout.sessionRpe ? workout.sessionRpe * minutes : 0 });
  }
  const s = summarizeWorkout(workout);
  const parts: string[] = [];
  if (s.volume > 0) parts.push(t('history.vol', { kg: formatNumber(s.volume, 0) }));
  if (s.distance > 0) parts.push(`${formatNumber(s.distance, 0)} ${t('units.m')}`);
  if (s.durationWork > 0) parts.push(t('history.work', { time: formatClock(s.durationWork) }));
  parts.push(s.warmups ? t('history.setsWarmups', { working: s.workingSets, warmups: s.warmups }) : tn('units.sets', s.sets));
  if (s.load > 0) parts.push(t('history.load', { load: s.load }));
  return parts.join(' · ');
}
export function recordHeadline(r: ExerciseRecord): string {
  switch (r.trackingType) {
    case TrackingType.DistanceTime:
      return r.topSpeed ? `${formatNumber(msToKmh(r.topSpeed.value))} km/h` : r.maxDistance ? `${formatNumber(r.maxDistance.value)} m` : '--';
    case TrackingType.Duration:
      return r.longest ? formatSeconds(r.longest.value) : '--';
    default:
      return r.maxWeight ? `${formatNumber(r.maxWeight.value, 2)} kg` : '--';
  }
}
export function prValue(event: { field: string; value: number }): string {
  switch (event.field) {
    case 'topSpeed': return `${formatNumber(msToKmh(event.value))} km/h`;
    case 'maxDistance': return `${formatNumber(event.value)} m`;
    case 'longest': return formatSeconds(event.value);
    default: return `${formatNumber(event.value)} kg`;
  }
}
export function heatTitle(day: { future: boolean; date: string; sessions: number; sets: number }): string {
  if (day.future) return '';
  return t('calendar.dayTitle', { date: formatDate(day.date), summary: day.sessions ? t('calendar.daySummary', { workouts: tn('units.workouts', day.sessions), sets: tn('units.sets', day.sets) }) : t('calendar.restDay') });
}
