// SprintLog v3 - Vue 3 (ESM-Browser-Build, kein Bundler nötig).
// Logik ist auf Module verteilt: api (HTTP), storage (localStorage), sync (Offline-Queue),
// analytics (Kennzahlen, unit-getestet), charts, feedback (Timer-Alarm), export.

import { createApp, nextTick } from '../vendor/vue.esm-browser.prod.js';
import { createApi } from './api.js';
import { Keys, userKeys, readJson, writeJson, remove, decodeToken, newClientId } from './storage.js';
import { syncQueue, queueAsWorkouts, migrateLegacyQueue, QueueStatus, isUpdate } from './sync.js';
import {
  TrackingType, trackingOf, epley1RM, setSpeed, msToKmh, trainingZone, roundTo, exerciseKey,
  computeRecords, detectPRs, workoutKey, summarizeWorkout, groupSetsByExercise, metricsFor,
  exerciseSeries, weeklyTotals, weekStreak, muscleDistribution, activityHeatmap, lastSetFor,
  usageCounts, inferWorkoutType, percentChange, dateKey, startOfWeek,
} from './analytics.js';
import {
  formatNumber, formatCompact, formatSeconds, formatClock, formatDuration, formatDate, formatTime,
  formatWeekday, formatRelative, describeSet,
} from './format.js';
import { renderProgressChart, renderWeeklyChart } from './charts.js';
import { unlockAudio, playRestAlarm, createWakeLock } from './feedback.js';
import { exportCsv, exportJson } from './export.js';
import { ExerciseFigure, techniqueFor } from './figure.js';

const DEFAULT_SETTINGS = Object.freeze({
  restGym: 90,
  restField: 120,
  autoTimer: true,
  sound: true,
  vibration: true,
  wakeLock: true,
  showTechnique: true,
});

const DEFAULTS = Object.freeze({ weight: 20, reps: 10, distance: 30, time: 4.5, duration: 60 });

/** RPE-Werte für Sätze (Reps in Reserve: 10 = Maximum, 8 = noch 2 Wiederholungen möglich). */
const SET_RPE = Object.freeze([6, 7, 7.5, 8, 8.5, 9, 9.5, 10]);

/** Session-RPE nach Borg CR-10 (Foster). */
const SESSION_RPE = Object.freeze([
  { value: 1, label: 'Very easy' }, { value: 2, label: 'Easy' }, { value: 3, label: 'Moderate' },
  { value: 4, label: 'Somewhat hard' }, { value: 5, label: 'Hard' }, { value: 6, label: 'Hard+' },
  { value: 7, label: 'Very hard' }, { value: 8, label: 'Very hard+' }, { value: 9, label: 'Extreme' },
  { value: 10, label: 'Maximal' },
]);

/** ISO-Datum -> Wert für <input type="datetime-local"> (lokale Zeit). */
function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_SESSION = () => ({ startedAt: null, sets: [], editing: null, meta: null });

// Chart-Instanzen bewusst NICHT reaktiv halten (Vue-Proxies um Chart.js kosten viel Performance).
const charts = { progress: null, weekly: null };
const destroyChart = (name) => { charts[name]?.destroy(); charts[name] = null; };

const wakeLock = createWakeLock();
let reloadOnControllerChange = false;

function readToken() {
  try { return localStorage.getItem(Keys.token) || ''; } catch { return ''; }
}
function writeToken(token) {
  try { token ? localStorage.setItem(Keys.token, token) : localStorage.removeItem(Keys.token); } catch { /* ignore */ }
}

const app = createApp({
  data() {
    return {
      // Auth
      token: '',
      user: null, // { userId, username }
      authMode: 'login',
      authForm: { username: '', password: '' },
      authBusy: false,
      authError: '',
      authFields: {},
      booting: true,

      // Verbindung / Sync
      online: navigator.onLine,
      syncing: false,
      updateWorker: null,

      // Daten
      exercises: [],
      history: [],
      favorites: [],
      queue: [],
      loadingExercises: false,
      loadingHistory: false,

      // Navigation
      tab: 'Gym',
      dataTab: 'overview',

      // Übungsliste
      search: '',
      sortMode: 'fav',
      sortOpen: false,
      muscleFilters: [],

      // Laufende Einheit
      session: EMPTY_SESSION(),
      showReview: false,
      finishModal: { open: false, sessionRpe: null, notes: '', date: '', durationMin: null, error: '' },

      // Satz-Dialog
      setModal: { open: false, exercise: null, editIndex: null, weight: 0, reps: 0, distance: 0, time: 0, rpe: null, isWarmup: false },

      // Eigene Übung
      customModal: { open: false, name: '', category: 'Gym', muscleGroup: '', trackingType: TrackingType.WeightReps, busy: false, error: '' },

      // Einstellungen
      settingsOpen: false,
      settings: { ...DEFAULT_SETTINGS },
      profile: null,
      deleteAccount: { open: false, password: '', busy: false, error: '' },

      // Dialog / Toasts
      dialog: { open: false, title: '', message: '', confirmText: 'Confirm', danger: false, resolve: null },
      toasts: [],

      // Pausentimer
      timer: { endAt: null, duration: 0 },
      now: Date.now(),     // Sekundentakt (Timer, Session-Dauer)
      clock: Date.now(),   // Minutentakt (Auswertungen)

      // Auswertungen
      historyFilter: 'all',
      historyLimit: 20,
      progress: { key: '', metric: '' },
      weeklyMetric: 'volume',
      selectedDay: null,

      TrackingType,
      SET_RPE,
      SESSION_RPE,
    };
  },

  computed: {
    isAuthenticated() { return !!this.token && !!this.user; },
    keys() { return this.user ? userKeys(this.user.userId) : null; },

    // ---------- Daten ----------
    exercisesById() { return new Map(this.exercises.map((e) => [e.id, e])); },

    /** Server-Historie + noch nicht synchronisierte Einheiten, neueste zuerst. */
    allWorkouts() {
      const pending = queueAsWorkouts(this.queue);
      const pendingIds = new Set(pending.map((w) => w.clientId));
      // Noch nicht synchronisierte Änderungen ersetzen die Server-Version in der Anzeige.
      const updatedIds = new Set(pending.filter((w) => w.op === 'update').map((w) => w.id));
      const synced = this.history.filter((w) => !(w.clientId && pendingIds.has(w.clientId)) && !updatedIds.has(w.id));
      return [...pending, ...synced].sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    records() { return computeRecords(this.allWorkouts); },
    prInfo() { return detectPRs(this.allWorkouts); },
    usage() { return usageCounts(this.allWorkouts); },
    pendingCount() { return this.queue.filter((q) => q.status === QueueStatus.Pending).length; },
    failedCount() { return this.queue.filter((q) => q.status === QueueStatus.Failed).length; },

    syncState() {
      if (!this.online) return { label: 'Offline', tone: 'red' };
      if (this.syncing) return { label: 'Syncing', tone: 'blue' };
      if (this.failedCount) return { label: `${this.failedCount} failed`, tone: 'red' };
      if (this.pendingCount) return { label: `${this.pendingCount} pending`, tone: 'orange' };
      return { label: 'Synced', tone: 'green' };
    },

    // ---------- Übungsliste ----------
    categoryExercises() { return this.exercises.filter((e) => e.category === this.tab); },

    availableMuscleGroups() {
      return [...new Set(this.categoryExercises.map((e) => e.muscleGroup || 'Other'))].sort();
    },

    allMuscleGroups() {
      return [...new Set(this.exercises.map((e) => e.muscleGroup).filter(Boolean))].sort();
    },

    filteredExercises() {
      const q = this.search.toLowerCase().trim();
      let list = this.categoryExercises;
      if (q) list = list.filter((e) => e.name.toLowerCase().includes(q) || (e.muscleGroup ?? '').toLowerCase().includes(q));
      if (this.muscleFilters.length) list = list.filter((e) => this.muscleFilters.includes(e.muscleGroup || 'Other'));

      const fav = (e) => (this.favorites.includes(e.id) ? 1 : 0);
      const used = (e) => this.usage.get(`id:${e.id}`) ?? 0;
      const last = (e) => this.records.get(`id:${e.id}`)?.lastDate ?? '';
      const byName = (a, b) => a.name.localeCompare(b.name);
      const sorters = {
        fav: (a, b) => fav(b) - fav(a) || byName(a, b),
        freq: (a, b) => used(b) - used(a) || byName(a, b),
        recent: (a, b) => String(last(b)).localeCompare(String(last(a))) || byName(a, b),
        az: byName,
        za: (a, b) => byName(b, a),
      };
      return [...list].sort(sorters[this.sortMode] ?? byName);
    },

    sortOptions() {
      return [
        { key: 'fav', label: 'Favorites' },
        { key: 'freq', label: 'Most used' },
        { key: 'recent', label: 'Recently trained' },
        { key: 'az', label: 'A - Z' },
        { key: 'za', label: 'Z - A' },
      ];
    },
    sortLabel() { return this.sortOptions.find((o) => o.key === this.sortMode)?.label; },

    // ---------- Laufende Einheit ----------
    sessionActive() { return this.session.sets.length > 0; },
    isEditing() { return !!this.session.editing; },
    finishLoad() {
      const f = this.finishModal;
      return f.sessionRpe > 0 && f.durationMin > 0 ? Math.round(f.sessionRpe * f.durationMin) : 0;
    },
    sessionElapsed() { return this.session.startedAt ? Math.max(0, (this.now - new Date(this.session.startedAt).getTime()) / 1000) : 0; },
    sessionGroups() { return groupSetsByExercise(this.session.sets); },
    sessionSummary() { return summarizeWorkout({ sets: this.session.sets }); },

    // ---------- Satz-Dialog ----------
    modalEx() { return this.setModal.exercise; },
    modalType() { return this.modalEx?.trackingType ?? TrackingType.WeightReps; },
    modalKey() { return this.modalEx ? exerciseKey({ exerciseId: this.modalEx.id, exerciseName: this.modalEx.name }) : ''; },
    modalRecord() { return this.modalEx ? this.records.get(this.modalKey) ?? null : null; },
    modalPrevious() { return this.modalEx ? lastSetFor(this.allWorkouts, this.modalKey) : null; },
    modalSessionSets() { return this.session.sets.filter((s) => s.exerciseId === this.modalEx?.id); },
    modalTechnique() { return techniqueFor(this.modalEx); },
    modalE1RM() { return epley1RM(this.setModal.weight, this.setModal.reps); },
    modalIntensity() {
      const pr = this.modalRecord?.maxWeight?.value ?? 0;
      return pr > 0 && this.setModal.weight > 0 ? Math.round((this.setModal.weight / pr) * 100) : 0;
    },
    modalZone() { return trainingZone(this.setModal.reps); },
    modalSpeed() { return setSpeed({ distance: this.setModal.distance, time: this.setModal.time }); },
    modalSpeedVsBest() {
      const best = this.modalRecord?.topSpeed?.value ?? 0;
      return best > 0 && this.modalSpeed > 0 ? Math.round((this.modalSpeed / best) * 100) : 0;
    },
    modalIsNewPR() {
      const r = this.modalRecord;
      if (!r || this.setModal.isWarmup) return false;
      if (this.modalType === TrackingType.WeightReps) return (r.maxWeight?.value ?? 0) > 0 && this.setModal.weight > r.maxWeight.value;
      if (this.modalType === TrackingType.DistanceTime) return (r.topSpeed?.value ?? 0) > 0 && this.modalSpeed > r.topSpeed.value;
      return (r.longest?.value ?? 0) > 0 && this.setModal.time > r.longest.value;
    },

    // ---------- Pausentimer ----------
    timerActive() { return !!this.timer.endAt; },
    timerLeft() { return this.timer.endAt ? Math.max(0, Math.ceil((this.timer.endAt - this.now) / 1000)) : 0; },
    timerProgress() { return this.timer.duration ? Math.min(1, this.timerLeft / this.timer.duration) : 0; },

    // ---------- Auswertungen ----------
    clockDate() { return new Date(this.clock); },
    weekly() { return weeklyTotals(this.allWorkouts, 12, this.clockDate); },
    kpis() {
      const weeks = this.weekly;
      const current = weeks[weeks.length - 1] ?? { volume: 0, sessions: 0, distance: 0 };
      const previous = weeks[weeks.length - 2] ?? { volume: 0, sessions: 0, distance: 0 };
      return {
        sessions: current.sessions,
        sessionsPrev: previous.sessions,
        volume: current.volume,
        volumeChange: percentChange(current.volume, previous.volume),
        distance: current.distance,
        streak: weekStreak(this.allWorkouts, this.clockDate),
        total: this.allWorkouts.length,
      };
    },
    muscleSplit() { return muscleDistribution(this.allWorkouts, 30, this.clockDate).slice(0, 8); },
    recentPRs() { return this.prInfo.events.slice(0, 6); },

    filteredHistory() {
      if (this.historyFilter === 'all') return this.allWorkouts;
      return this.allWorkouts.filter((w) => w.workoutType === this.historyFilter);
    },
    visibleHistory() { return this.filteredHistory.slice(0, this.historyLimit); },

    progressOptions() {
      return [...this.records.values()]
        .filter((r) => r.sessions > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    progressRecord() { return this.records.get(this.progress.key) ?? null; },
    progressMetrics() { return metricsFor(this.progressRecord?.trackingType); },
    progressMetric() { return this.progressMetrics.find((m) => m.key === this.progress.metric) ?? this.progressMetrics[0]; },
    progressSeries() {
      return this.progressRecord ? exerciseSeries(this.allWorkouts, this.progress.key, this.progressMetric.key) : [];
    },
    progressDelta() {
      const s = this.progressSeries;
      if (s.length < 2) return null;
      const change = percentChange(s[s.length - 1].value, s[0].value);
      return this.progressMetric.lowerIsBetter && change !== null ? -change : change;
    },

    recordList() {
      return [...this.records.values()].sort((a, b) => a.name.localeCompare(b.name));
    },

    heatmap() { return activityHeatmap(this.allWorkouts, 26, this.clockDate); },
    selectedDayWorkouts() {
      return this.selectedDay ? this.allWorkouts.filter((w) => dateKey(w.date) === this.selectedDay) : [];
    },
    activeDaysLast30() {
      const since = this.clock - 30 * 86_400_000;
      return new Set(this.allWorkouts.filter((w) => new Date(w.date).getTime() >= since).map((w) => dateKey(w.date))).size;
    },
  },

  watch: {
    settings: { deep: true, handler(value) { writeJson(Keys.settings, value); this.updateWakeLock(); } },
    sessionActive() { this.updateWakeLock(); },
    dataTab(value) {
      if (value === 'progress' && !this.progress.key) this.selectDefaultProgress();
      this.renderCharts();
    },
    tab(value) {
      this.muscleFilters = [];
      if (value === 'Data') {
        if (this.online) this.loadHistory();
        this.renderCharts();
      } else {
        destroyChart('progress');
        destroyChart('weekly');
      }
    },
    'progress.key'() {
      this.progress.metric = this.progressMetrics[0]?.key ?? '';
      this.renderCharts();
    },
    'progress.metric'() { this.renderCharts(); },
    weeklyMetric() { this.renderCharts(); },
    allWorkouts() { if (this.tab === 'Data') this.renderCharts(); },
  },

  async mounted() {
    this.settings = { ...DEFAULT_SETTINGS, ...readJson(Keys.settings, {}) };

    window.addEventListener('online', () => { this.online = true; this.refreshAll(); });
    window.addEventListener('offline', () => { this.online = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.now = Date.now();
        this.clock = Date.now();
        if (this.isAuthenticated && this.online) this.syncNow();
      }
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeTopLayer(); });

    setInterval(() => { this.now = Date.now(); this.checkTimer(); }, 500);
    setInterval(() => { this.clock = Date.now(); }, 60_000);
    // Hintergrund-Sync alle 2 Minuten, falls etwas offen ist.
    setInterval(() => { if (this.isAuthenticated && this.online && this.pendingCount) this.syncNow(); }, 120_000);

    this.registerServiceWorker();

    const token = readToken();
    if (token) {
      const stored = readJson(Keys.user);
      const decoded = decodeToken(token);
      const user = stored?.userId ? stored : decoded.userId ? { userId: decoded.userId, username: decoded.username } : null;
      if (user) {
        this.token = token;
        this.user = user;
        this.hydrate();
        this.booting = false;
        await this.refreshAll({ refreshToken: true });
        return;
      }
      writeToken('');
    }
    this.booting = false;
  },

  methods: {
    // Formatierer im Template verfügbar machen
    formatNumber, formatCompact, formatSeconds, formatClock, formatDuration, formatDate, formatTime,
    formatWeekday, formatRelative, describeSet, trackingOf, msToKmh, workoutKey, summarizeWorkout, groupSetsByExercise,

    // =====================================================================
    // Auth
    // =====================================================================
    api() {
      return createApi({ getToken: () => this.token, onUnauthorized: () => this.handleUnauthorized() });
    },

    async submitAuth() {
      this.authError = '';
      this.authFields = {};
      const username = this.authForm.username.trim();
      const { password } = this.authForm;
      if (!username || !password) {
        this.authError = 'Username and password are required.';
        return;
      }
      if (this.authMode === 'register' && password.length < 8) {
        this.authFields = { password: ['Password must be at least 8 characters.'] };
        return;
      }

      this.authBusy = true;
      try {
        const path = this.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
        const result = await this.api().post(path, { username, password });
        this.setAuth(result.token, { userId: result.userId, username: result.username });
        this.authForm.password = '';
        this.hydrate();
        this.toast(this.authMode === 'register' ? `Welcome, ${result.username}!` : `Logged in as ${result.username}`, 'success');
        await this.refreshAll();
      } catch (e) {
        this.authError = e.isNetwork ? 'No connection to server. Login requires internet once.' : e.message;
        this.authFields = e.fields ?? {};
      } finally {
        this.authBusy = false;
      }
    },

    fieldError(field) {
      const entry = Object.entries(this.authFields).find(([k]) => k.toLowerCase() === field);
      return entry ? entry[1][0] : '';
    },

    setAuth(token, user) {
      this.token = token;
      this.user = user;
      writeToken(token);
      writeJson(Keys.user, user);
    },

    async refreshToken() {
      try {
        const result = await this.api().post('/api/auth/refresh');
        this.setAuth(result.token, { userId: result.userId, username: result.username });
      } catch (e) {
        if (e.isNetwork) this.online = false;
      }
    },

    handleUnauthorized() {
      if (!this.token) return;
      this.toast('Session expired. Please log in again.', 'error');
      this.clearAuth();
    },

    async logout() {
      if (this.queue.length) {
        const ok = await this.confirm({
          title: 'Unsynced workouts',
          message: `${this.queue.length} workout(s) are not synced yet. They stay on this device and sync after your next login.`,
          confirmText: 'Log out',
        });
        if (!ok) return;
      }
      this.settingsOpen = false;
      this.clearAuth();
    },

    clearAuth() {
      // Cache der Historie entfernen (geteilte Geräte); Queue + laufende Einheit bleiben für dieses Konto erhalten.
      if (this.keys) {
        remove(this.keys.history);
        remove(this.keys.exercises);
        remove(this.keys.favorites);
      }
      writeToken('');
      remove(Keys.user);
      this.token = '';
      this.user = null;
      this.exercises = [];
      this.history = [];
      this.favorites = [];
      this.queue = [];
      this.session = EMPTY_SESSION();
      this.timer = { endAt: null, duration: 0 };
      this.profile = null;
      this.tab = 'Gym';
      this.closeAllLayers();
    },

    // =====================================================================
    // Daten laden / Cache
    // =====================================================================
    hydrate() {
      const k = this.keys;
      this.exercises = readJson(k.exercises, []);
      this.history = readJson(k.history, []);
      this.favorites = readJson(k.favorites, []);
      this.queue = readJson(k.queue, []);
      this.session = { ...EMPTY_SESSION(), ...readJson(k.session, {}) };
      this.timer = readJson(k.timer, { endAt: null, duration: 0 });
      this.migrateLegacyStorage();
    },

    /** Übernimmt Daten aus v2 (globale Schlüssel ohne Nutzerbezug). */
    migrateLegacyStorage() {
      const legacyQueue = readJson(Keys.legacyQueue, null);
      if (Array.isArray(legacyQueue)) {
        const migrated = migrateLegacyQueue(legacyQueue, newClientId);
        if (migrated.length) this.queue = [...this.queue, ...migrated];
        remove(Keys.legacyQueue);
        this.persistQueue();
      }
      const legacySets = readJson(Keys.legacySets, null);
      if (Array.isArray(legacySets)) {
        if (!this.session.sets.length && legacySets.length) {
          this.session = {
            startedAt: new Date().toISOString(),
            sets: legacySets.map((s) => ({ ...s, exerciseName: s.exerciseName ?? s.name, trackingType: trackingOf(s) })),
          };
          this.persistSession();
        }
        remove(Keys.legacySets);
      }
    },

    async refreshAll({ refreshToken = false } = {}) {
      if (!this.isAuthenticated) return;
      if (refreshToken) await this.refreshToken();
      if (!this.isAuthenticated) return;
      await Promise.allSettled([this.loadExercises(), this.loadFavorites()]);
      await this.syncNow({ reload: false });
      await this.loadHistory();
    },

    async loadExercises() {
      this.loadingExercises = !this.exercises.length;
      try {
        this.exercises = await this.api().get('/api/exercises');
        writeJson(this.keys.exercises, this.exercises);
        this.online = true;
        this.enrichSession();
      } catch (e) {
        if (e.isNetwork) this.online = false;
      } finally {
        this.loadingExercises = false;
      }
    },

    async loadHistory() {
      if (!this.isAuthenticated) return false;
      this.loadingHistory = !this.history.length;
      try {
        this.history = await this.api().get('/api/workouts/history');
        writeJson(this.keys.history, this.history);
        this.online = true;
        return true;
      } catch (e) {
        if (e.isNetwork) this.online = false;
        return false;
      } finally {
        this.loadingHistory = false;
      }
    },

    async loadFavorites() {
      try {
        this.favorites = await this.api().get('/api/favorites');
        writeJson(this.keys.favorites, this.favorites);
      } catch (e) {
        if (e.isNetwork) this.online = false;
      }
    },

    async loadProfile() {
      if (!this.online) return;
      try { this.profile = await this.api().get('/api/auth/me'); } catch { /* optional */ }
    },

    persistQueue() { if (this.keys) writeJson(this.keys.queue, this.queue); },
    persistSession() { if (this.keys) writeJson(this.keys.session, this.session.sets.length ? this.session : null); },
    persistTimer() { if (this.keys) writeJson(this.keys.timer, this.timer.endAt ? this.timer : null); },

    // =====================================================================
    // Synchronisation
    // =====================================================================
    async syncNow({ reload = true } = {}) {
      if (this.syncing || !this.isAuthenticated || !this.queue.some((q) => q.status === QueueStatus.Pending)) return;
      this.syncing = true;
      const before = this.queue;
      try {
        const api = this.api();
        const result = await syncQueue(before, (payload, entry) => (isUpdate(entry)
          ? api.put(`/api/workouts/${entry.workoutId}`, payload)
          : api.post('/api/workouts', payload)));
        if (!this.isAuthenticated) return;
        // Einträge, die während des Syncs neu hinzugekommen sind, nicht verlieren.
        const added = this.queue.filter((q) => !before.includes(q));
        const syncedEntries = before.filter((q) => !result.queue.some((r) => r.clientId === q.clientId));
        this.queue = [...result.queue, ...added];
        this.persistQueue();

        if (result.stoppedBy === 'network') this.online = false;
        if (result.stoppedBy === 'auth') this.handleUnauthorized();
        const newlyFailed = result.queue.filter((q) => q.status === QueueStatus.Failed && !before.find((b) => b.clientId === q.clientId && b.status === QueueStatus.Failed));
        if (newlyFailed.length) this.toast(`${newlyFailed.length} workout(s) rejected by server: ${newlyFailed[0].error}`, 'error');

        if (result.synced > 0) {
          const loaded = reload ? await this.loadHistory() : true;
          if (!loaded) {
            // Historie konnte nicht neu geladen werden - synchronisierte Einheiten trotzdem anzeigen.
            this.history = [...queueAsWorkouts(syncedEntries).map((w) => ({ ...w, pending: false })), ...this.history];
          }
        }
      } finally {
        this.syncing = false;
      }
    },

    async retryEntry(workout) {
      this.queue = this.queue.map((q) => (q.clientId === workout.clientId ? { ...q, status: QueueStatus.Pending, error: null } : q));
      this.persistQueue();
      await this.syncNow();
    },

    // =====================================================================
    // Favoriten
    // =====================================================================
    async toggleFavorite(ex) {
      if (!this.online) { this.toast('Favorites need a connection.', 'error'); return; }
      const isFav = this.favorites.includes(ex.id);
      this.favorites = isFav ? this.favorites.filter((id) => id !== ex.id) : [...this.favorites, ex.id];
      try {
        if (isFav) await this.api().del(`/api/favorites/${ex.id}`);
        else await this.api().post(`/api/favorites/${ex.id}`);
        writeJson(this.keys.favorites, this.favorites);
      } catch (e) {
        this.toast(e.message, 'error');
        await this.loadFavorites();
      }
    },

    toggleMuscleFilter(group) {
      this.muscleFilters = this.muscleFilters.includes(group)
        ? this.muscleFilters.filter((g) => g !== group)
        : [...this.muscleFilters, group];
    },

    selectSort(mode) { this.sortMode = mode; this.sortOpen = false; },

    lastSetLabel(ex) {
      const last = lastSetFor(this.allWorkouts, `id:${ex.id}`);
      return last ? `${describeSet(last, ex.trackingType)} · ${formatRelative(last.date, this.clockDate)}` : '';
    },

    trackingLabel(type) {
      return { WeightReps: 'Weight × Reps', DistanceTime: 'Distance + Time', Duration: 'Duration' }[type] ?? type;
    },

    // =====================================================================
    // Satz erfassen
    // =====================================================================
    openSetModal(ex, editIndex = null) {
      const sessionSets = this.session.sets.filter((s) => s.exerciseId === ex.id);
      const source = editIndex !== null
        ? this.session.sets[editIndex]
        : sessionSets[sessionSets.length - 1] ?? lastSetFor(this.allWorkouts, `id:${ex.id}`);

      const type = ex.trackingType ?? TrackingType.WeightReps;
      this.setModal = {
        open: true,
        exercise: ex,
        editIndex,
        weight: source?.weight ?? (type === TrackingType.WeightReps ? DEFAULTS.weight : 0),
        reps: source?.reps ?? (type === TrackingType.WeightReps ? DEFAULTS.reps : 0),
        distance: source?.distance ?? (type === TrackingType.DistanceTime ? DEFAULTS.distance : 0),
        time: source?.time ?? (type === TrackingType.Duration ? DEFAULTS.duration : type === TrackingType.DistanceTime ? DEFAULTS.time : 0),
        rpe: editIndex !== null ? source?.rpe ?? null : null,
        isWarmup: editIndex !== null ? !!source?.isWarmup : false,
      };
    },

    closeSetModal() { this.setModal.open = false; },

    step(field, delta, min = 0, decimals = 2) {
      const value = Number(this.setModal[field]) || 0;
      const factor = 10 ** decimals;
      this.setModal[field] = Math.max(min, Math.round((value + delta) * factor) / factor);
    },

    setWeightByPercentage(percent) {
      const pr = this.modalRecord?.maxWeight?.value ?? 0;
      if (pr > 0) this.setModal.weight = roundTo(pr * (percent / 100), 2.5);
    },

    copyPrevious() {
      const p = this.modalPrevious;
      if (!p) return;
      Object.assign(this.setModal, { weight: p.weight ?? 0, reps: p.reps ?? 0, distance: p.distance ?? 0, time: p.time ?? 0 });
    },

    buildSet() {
      const ex = this.setModal.exercise;
      const type = ex.trackingType ?? TrackingType.WeightReps;
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const set = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        trackingType: type,
        muscleGroup: ex.muscleGroup,
        category: ex.category,
        weight: null, reps: null, distance: null, time: null,
        rpe: this.setModal.rpe ?? null,
        isWarmup: !!this.setModal.isWarmup,
      };
      if (type === TrackingType.WeightReps) {
        set.weight = Math.max(0, num(this.setModal.weight));
        set.reps = Math.max(0, Math.round(num(this.setModal.reps)));
        if (set.reps < 1) return { error: 'Reps must be at least 1.' };
        if (set.weight > 1000) return { error: 'Weight looks wrong (max 1000 kg).' };
      } else if (type === TrackingType.DistanceTime) {
        set.distance = Math.max(0, num(this.setModal.distance));
        set.time = Math.max(0, num(this.setModal.time));
        if (!(set.distance > 0) && !(set.time > 0)) return { error: 'Enter distance and/or time.' };
      } else {
        set.time = Math.max(0, num(this.setModal.time));
        if (!(set.time > 0)) return { error: 'Duration must be greater than 0.' };
      }
      return { set };
    },

    saveSet() {
      unlockAudio();
      const { set, error } = this.buildSet();
      if (error) { this.toast(error, 'error'); return; }

      const wasPR = this.modalIsNewPR;
      if (this.setModal.editIndex !== null) {
        this.session.sets.splice(this.setModal.editIndex, 1, set);
      } else {
        if (!this.session.startedAt || !this.session.sets.length) this.session.startedAt = new Date().toISOString();
        this.session.sets.push(set);
        if (this.settings.autoTimer && !this.isEditing) this.startTimer(set.category === 'Football' ? this.settings.restField : this.settings.restGym);
        if (navigator.vibrate && this.settings.vibration) navigator.vibrate(15);
      }
      this.persistSession();
      this.closeSetModal();
      if (wasPR) this.toast(`New record on ${set.exerciseName}!`, 'gold');
    },

    editSessionSet(index) {
      const set = this.session.sets[index];
      const ex = this.exercisesById.get(set.exerciseId) ?? {
        id: set.exerciseId, name: set.exerciseName, category: set.category ?? 'Gym',
        muscleGroup: set.muscleGroup, trackingType: trackingOf(set),
      };
      this.showReview = false;
      this.openSetModal(ex, index);
    },

    removeSessionSet(index) {
      this.session.sets.splice(index, 1);
      if (!this.session.sets.length && !this.isEditing) { this.session.startedAt = null; this.showReview = false; }
      this.persistSession();
    },

    /** Ergänzt Kategorie/Typ für Sätze aus Altdaten, sobald der Übungskatalog geladen ist. */
    enrichSession() {
      if (!this.session.sets.length) return;
      this.session.sets = this.session.sets.map((s) => {
        const ex = this.exercisesById.get(s.exerciseId);
        return ex ? { ...s, category: s.category ?? ex.category, trackingType: s.trackingType ?? ex.trackingType, muscleGroup: s.muscleGroup ?? ex.muscleGroup } : s;
      });
      this.persistSession();
    },

    async abortSession() {
      const ok = await this.confirm(this.isEditing
        ? { title: 'Discard changes?', message: 'The workout stays as it was before editing.', confirmText: 'Discard', danger: true }
        : { title: 'Discard session?', message: 'All sets of the current session will be deleted.', confirmText: 'Discard', danger: true });
      if (!ok) return;
      this.session = EMPTY_SESSION();
      this.persistSession();
      this.stopTimer();
      this.showReview = false;
    },

    /** Schritt 1: Abschluss-Dialog (Session-RPE, Notiz, Datum, Dauer). */
    finishSession() {
      if (!this.session.sets.length) return;
      const meta = this.session.meta;
      const startedAt = this.session.startedAt ?? new Date().toISOString();
      const elapsedMin = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
      this.finishModal = {
        open: true,
        sessionRpe: meta?.sessionRpe ?? null,
        notes: meta?.notes ?? '',
        date: toLocalInput(meta?.date ?? startedAt),
        durationMin: meta
          ? (meta.durationSeconds ? Math.round(meta.durationSeconds / 60) : null)
          : (elapsedMin > 0 && elapsedMin <= 1440 ? elapsedMin : null),
        error: '',
      };
      this.showReview = false;
    },

    /** Schritt 2: Einheit lokal sichern (Queue) und synchronisieren. */
    async confirmFinish() {
      const f = this.finishModal;
      const date = f.date ? new Date(f.date) : new Date(this.session.startedAt ?? Date.now());
      if (Number.isNaN(date.getTime())) { f.error = 'Invalid date.'; return; }
      if (date.getTime() > Date.now() + 60 * 60 * 1000) { f.error = 'Date cannot be in the future.'; return; }
      const minutes = Number(f.durationMin);
      const base = {
        date: date.toISOString(),
        durationSeconds: minutes > 0 && minutes <= 1440 ? Math.round(minutes * 60) : null,
        sessionRpe: f.sessionRpe ?? null,
        notes: f.notes?.trim() ? f.notes.trim().slice(0, 500) : null,
        workoutType: inferWorkoutType(this.session.sets),
        sets: this.session.sets.map((s) => ({ ...s })),
        status: QueueStatus.Pending,
        attempts: 0,
        error: null,
      };

      // 1. Immer zuerst lokal sichern (offline-first) ...
      const editing = this.session.editing;
      if (editing?.kind === 'server') {
        const entry = { ...base, op: 'update', workoutId: editing.id, clientId: editing.clientId ?? newClientId() };
        this.queue = [...this.queue.filter((q) => !(isUpdate(q) && q.workoutId === editing.id)), entry];
      } else if (editing?.kind === 'pending') {
        const existing = this.queue.find((q) => q.clientId === editing.clientId);
        const entry = { ...base, op: existing?.op ?? 'create', workoutId: existing?.workoutId, clientId: editing.clientId };
        this.queue = existing ? this.queue.map((q) => (q === existing ? entry : q)) : [...this.queue, entry];
      } else {
        this.queue = [...this.queue, { ...base, clientId: newClientId() }];
      }
      this.persistQueue();

      this.session = EMPTY_SESSION();
      this.persistSession();
      this.stopTimer();
      this.finishModal.open = false;
      this.tab = 'Data';
      this.dataTab = 'history';
      const verb = editing ? 'updated' : 'saved';
      this.toast(this.online ? `Workout ${verb}.` : `Workout ${verb} offline - will sync automatically.`, 'success');

      // 2. ... dann synchronisieren.
      await this.syncNow();
    },

    /** Sätze einer Einheit in das Format der laufenden Session übernehmen. */
    toSessionSets(sets, { keepDetails }) {
      return sets.map((s) => {
        const ex = this.exercisesById.get(s.exerciseId);
        return {
          exerciseId: s.exerciseId,
          exerciseName: s.exerciseName,
          trackingType: s.trackingType ?? ex?.trackingType ?? trackingOf(s),
          muscleGroup: s.muscleGroup ?? ex?.muscleGroup,
          category: s.category ?? ex?.category,
          weight: s.weight, reps: s.reps, distance: s.distance, time: s.time,
          rpe: keepDetails ? s.rpe ?? null : null,
          isWarmup: !!s.isWarmup,
        };
      });
    },

    async repeatWorkout(workout) {
      if (this.sessionActive) {
        const ok = await this.confirm({ title: 'Replace session?', message: 'Your current session will be replaced by this workout.', confirmText: 'Replace' });
        if (!ok) return;
      }
      this.session = { ...EMPTY_SESSION(), startedAt: new Date().toISOString(), sets: this.toSessionSets(workout.sets, { keepDetails: false }) };
      this.persistSession();
      this.tab = this.session.sets.some((s) => s.category === 'Gym') ? 'Gym' : 'Football';
      this.showReview = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /** Bestehende Einheit bearbeiten: wird in die Session geladen, "Finish" speichert per PUT (auch offline über die Queue). */
    async editWorkout(workout) {
      if (!workout.pending && !workout.id) return;
      if (this.sessionActive) {
        const ok = await this.confirm({ title: 'Replace session?', message: 'Your current session will be replaced by the workout you edit.', confirmText: 'Edit' });
        if (!ok) return;
      }
      this.stopTimer();
      this.session = {
        startedAt: workout.date,
        sets: this.toSessionSets(workout.sets, { keepDetails: true }),
        editing: workout.pending ? { kind: 'pending', clientId: workout.clientId } : { kind: 'server', id: workout.id, clientId: workout.clientId },
        meta: { date: workout.date, durationSeconds: workout.durationSeconds, sessionRpe: workout.sessionRpe, notes: workout.notes },
      };
      this.persistSession();
      this.tab = this.session.sets.some((s) => s.category === 'Football') && !this.session.sets.some((s) => s.category === 'Gym') ? 'Football' : 'Gym';
      this.showReview = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async deleteWorkout(workout) {
      if (workout.pending) {
        const ok = await this.confirm(workout.op === 'update'
          ? { title: 'Discard changes?', message: 'Your unsynced changes are removed; the saved version stays.', confirmText: 'Discard', danger: true }
          : { title: 'Discard workout?', message: 'This workout was not synced yet and will be removed from this device.', confirmText: 'Discard', danger: true });
        if (!ok) return;
        this.queue = this.queue.filter((q) => q.clientId !== workout.clientId);
        this.persistQueue();
        return;
      }
      if (!this.online) { this.toast('Deleting needs a connection.', 'error'); return; }
      const ok = await this.confirm({
        title: 'Delete workout?',
        message: `${formatDate(workout.date)} · ${workout.sets.length} sets. This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        await this.api().del(`/api/workouts/${workout.id}`);
        this.history = this.history.filter((w) => w.id !== workout.id);
        writeJson(this.keys.history, this.history);
        this.toast('Workout deleted.', 'success');
      } catch (e) {
        this.toast(e.message, 'error');
      }
    },

    setBadges(workout, index) {
      return this.prInfo.badges.get(`${workoutKey(workout)}#${index}`) ?? [];
    },

    badgeClass(tone) {
      return {
        gold: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
        orange: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
        green: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
      }[tone] ?? 'text-accent bg-accent/10 border-accent/30';
    },

    workoutStats(workout) {
      const s = summarizeWorkout(workout);
      const parts = [];
      if (s.volume > 0) parts.push(`${formatNumber(s.volume, 0)} kg vol`);
      if (s.distance > 0) parts.push(`${formatNumber(s.distance, 0)} m`);
      if (s.durationWork > 0) parts.push(`${formatClock(s.durationWork)} work`);
      parts.push(s.warmups ? `${s.workingSets}+${s.warmups}w sets` : `${s.sets} sets`);
      if (s.load > 0) parts.push(`load ${s.load}`);
      return parts.join(' · ');
    },

    typeColor(type) {
      return { Gym: 'purple', Football: 'blue', Hybrid: 'green' }[type] ?? 'blue';
    },

    // =====================================================================
    // Eigene Übungen
    // =====================================================================
    openCustomModal() {
      if (!this.online) { this.toast('Creating exercises needs a connection.', 'error'); return; }
      this.customModal = {
        open: true,
        name: this.search.trim(),
        category: this.tab === 'Football' ? 'Football' : 'Gym',
        muscleGroup: this.muscleFilters[0] ?? '',
        trackingType: this.tab === 'Football' ? TrackingType.DistanceTime : TrackingType.WeightReps,
        busy: false,
        error: '',
      };
    },

    async saveCustomExercise() {
      const m = this.customModal;
      m.error = '';
      if (m.name.trim().length < 2) { m.error = 'Name must be at least 2 characters.'; return; }
      m.busy = true;
      try {
        const created = await this.api().post('/api/exercises', {
          name: m.name.trim(), category: m.category, muscleGroup: m.muscleGroup.trim() || null, trackingType: m.trackingType,
        });
        this.exercises = [...this.exercises, created];
        writeJson(this.keys.exercises, this.exercises);
        m.open = false;
        this.search = '';
        this.tab = created.category;
        this.toast(`"${created.name}" created.`, 'success');
        this.openSetModal(created);
      } catch (e) {
        m.error = e.message;
      } finally {
        m.busy = false;
      }
    },

    async deleteCustomExercise(ex) {
      const ok = await this.confirm({ title: 'Delete exercise?', message: `"${ex.name}" will be removed from your catalog.`, confirmText: 'Delete', danger: true });
      if (!ok) return;
      try {
        await this.api().del(`/api/exercises/${ex.id}`);
        this.exercises = this.exercises.filter((e) => e.id !== ex.id);
        this.favorites = this.favorites.filter((id) => id !== ex.id);
        writeJson(this.keys.exercises, this.exercises);
        this.closeSetModal();
        this.toast('Exercise deleted.', 'success');
      } catch (e) {
        this.toast(e.message, 'error');
      }
    },

    // =====================================================================
    // Pausentimer
    // =====================================================================
    startTimer(seconds) {
      this.timer = { endAt: Date.now() + seconds * 1000, duration: seconds };
      this.persistTimer();
    },
    adjustTimer(delta) {
      if (!this.timer.endAt) return;
      this.timer = { endAt: this.timer.endAt + delta * 1000, duration: Math.max(1, this.timer.duration + delta) };
      this.persistTimer();
      this.checkTimer();
    },
    stopTimer() {
      this.timer = { endAt: null, duration: 0 };
      this.persistTimer();
    },
    checkTimer() {
      if (!this.timer.endAt || Date.now() < this.timer.endAt) return;
      const lateBy = Date.now() - this.timer.endAt;
      this.stopTimer();
      // Alarm nur, wenn das Ende "live" erlebt wurde (nicht nach Stunden im Hintergrund).
      if (lateBy < 60_000) {
        playRestAlarm({ sound: this.settings.sound, vibration: this.settings.vibration });
        this.toast('Rest is over - next set!', 'success');
      }
    },

    updateWakeLock() {
      wakeLock.set(this.settings.wakeLock && this.sessionActive);
    },

    // =====================================================================
    // Auswertungen / Charts
    // =====================================================================
    selectDefaultProgress() {
      // Meistgeloggte Übung vorauswählen
      const top = [...this.records.values()].sort((a, b) => b.sessions - a.sessions)[0];
      if (top) this.progress.key = top.key;
    },

    openProgress(key) {
      this.tab = 'Data';
      this.dataTab = 'progress';
      this.progress.key = key;
    },

    recordHeadline(r) {
      switch (r.trackingType) {
        case TrackingType.DistanceTime:
          return r.topSpeed ? `${formatNumber(msToKmh(r.topSpeed.value))} km/h` : r.maxDistance ? `${formatNumber(r.maxDistance.value)} m` : '--';
        case TrackingType.Duration:
          return r.longest ? formatSeconds(r.longest.value) : '--';
        default:
          return r.maxWeight ? `${formatNumber(r.maxWeight.value, 2)} kg` : '--';
      }
    },

    prValue(event) {
      switch (event.field) {
        case 'topSpeed': return `${formatNumber(msToKmh(event.value))} km/h`;
        case 'maxDistance': return `${formatNumber(event.value)} m`;
        case 'longest': return formatSeconds(event.value);
        default: return `${formatNumber(event.value)} kg`;
      }
    },

    async renderCharts() {
      if (this.tab !== 'Data') return;
      await nextTick();
      destroyChart('progress');
      destroyChart('weekly');

      if (this.dataTab === 'overview' && this.$refs.weeklyCanvas) {
        charts.weekly = renderWeeklyChart(this.$refs.weeklyCanvas, this.weekly, {
          metric: this.weeklyMetric,
          unit: { volume: 'kg', distance: 'm', sessions: '', load: 'AU' }[this.weeklyMetric],
        });
      }
      if (this.dataTab === 'calendar' && this.$refs.heatScroll) {
        // Neueste Wochen sichtbar machen (rechts)
        this.$refs.heatScroll.scrollLeft = this.$refs.heatScroll.scrollWidth;
      }
      if (this.dataTab === 'progress' && this.$refs.progressCanvas && this.progressSeries.length) {
        charts.progress = renderProgressChart(this.$refs.progressCanvas, this.progressSeries, {
          label: this.progressMetric.label,
          unit: this.progressMetric.unit,
          lowerIsBetter: !!this.progressMetric.lowerIsBetter,
          field: this.progressRecord?.trackingType !== TrackingType.WeightReps,
        });
      }
    },

    heatTitle(day) {
      if (day.future) return '';
      return `${formatDate(day.date)}: ${day.sessions ? `${day.sessions} workout(s), ${day.sets} sets` : 'rest day'}`;
    },

    // =====================================================================
    // Einstellungen / Konto
    // =====================================================================
    openSettings() {
      this.settingsOpen = true;
      this.deleteAccount = { open: false, password: '', busy: false, error: '' };
      this.loadProfile();
    },

    resetSettings() { this.settings = { ...DEFAULT_SETTINGS }; },

    exportData(format) {
      if (!this.allWorkouts.length) { this.toast('Nothing to export yet.', 'error'); return; }
      if (format === 'csv') exportCsv(this.user.username, this.allWorkouts);
      else exportJson(this.user.username, this.allWorkouts);
    },

    async confirmDeleteAccount() {
      const d = this.deleteAccount;
      d.error = '';
      if (!d.password) { d.error = 'Enter your password to confirm.'; return; }
      d.busy = true;
      try {
        await this.api().del('/api/auth/account', { password: d.password });
        if (this.keys) Object.values(this.keys).forEach(remove);
        this.toast('Account and all data deleted.', 'success');
        this.clearAuth();
      } catch (e) {
        d.error = e.message;
      } finally {
        d.busy = false;
      }
    },

    // =====================================================================
    // Service Worker (Offline + Update-Hinweis)
    // =====================================================================
    registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      // Nur neu laden, wenn der Nutzer das Update bestätigt hat (nicht bei der allerersten Installation).
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadOnControllerChange) window.location.reload();
      });
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) this.updateWorker = registration.waiting;
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) this.updateWorker = worker;
          });
        });
        // Beim Zurückkehren in die App nach Updates suchen.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      }).catch((e) => console.warn('[sw] registration failed', e));
    },
    applyUpdate() {
      if (!this.updateWorker) return;
      reloadOnControllerChange = true;
      this.updateWorker.postMessage({ type: 'SKIP_WAITING' });
    },

    // =====================================================================
    // UI-Helfer: Dialog, Toasts, Layer
    // =====================================================================
    confirm({ title, message, confirmText = 'Confirm', danger = false }) {
      return new Promise((resolve) => {
        this.dialog = { open: true, title, message, confirmText, danger, resolve };
      });
    },
    resolveDialog(result) {
      const resolve = this.dialog.resolve;
      this.dialog = { ...this.dialog, open: false, resolve: null };
      resolve?.(result);
    },

    toast(message, tone = 'info') {
      const id = Date.now() + Math.random();
      this.toasts = [...this.toasts.slice(-2), { id, message, tone }];
      setTimeout(() => { this.toasts = this.toasts.filter((t) => t.id !== id); }, tone === 'error' ? 5000 : 3000);
    },

    toastClass(tone) {
      return {
        success: 'border-emerald-400/40 text-emerald-300',
        error: 'border-red-400/40 text-red-300',
        gold: 'border-yellow-400/50 text-yellow-300',
      }[tone] ?? 'border-accent/40 text-accent';
    },

    /** "SET 1", "SET 2" ... für Arbeitssätze, "WU" für Aufwärmsätze. */
    setLabel(sets, n) {
      if (sets[n]?.isWarmup) return 'WU';
      return `SET ${sets.slice(0, n + 1).filter((x) => !x.isWarmup).length}`;
    },

    rpeText(value) { return value ? `@${formatNumber(value, 1)}` : ''; },
    sessionRpeLabel(value) { return SESSION_RPE.find((r) => r.value === value)?.label ?? ''; },

    closeTopLayer() {
      if (this.dialog.open) return this.resolveDialog(false);
      if (this.finishModal.open) { this.finishModal.open = false; return; }
      if (this.setModal.open) return this.closeSetModal();
      if (this.customModal.open) { this.customModal.open = false; return; }
      if (this.showReview) { this.showReview = false; return; }
      if (this.settingsOpen) { this.settingsOpen = false; return; }
      if (this.sortOpen) this.sortOpen = false;
    },

    closeAllLayers() {
      if (this.dialog.open) this.resolveDialog(false);
      this.setModal.open = false;
      this.customModal.open = false;
      this.finishModal.open = false;
      this.showReview = false;
      this.settingsOpen = false;
      this.sortOpen = false;
    },

    weekLabel(iso) { return formatDate(iso, { day: '2-digit', month: 'short' }); },
    isThisWeek(iso) { return dateKey(startOfWeek(iso)) === dateKey(startOfWeek(this.clockDate)); },
  },
});

app.component('exercise-figure', ExerciseFigure);
app.mount('#app');
