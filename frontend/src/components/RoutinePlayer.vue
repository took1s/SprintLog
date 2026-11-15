<script setup lang="ts">
// Routine mit Timer durchspielen: Schritt für Schritt, Halten mit Countdown (3-2-1-Ticks, Signal, Musik leiser),
// Seitenwechsel und Pausen automatisch, Wiederholungen mit "Fertig". Am Ende wird der nächste Durchgang abgehakt
// (Reha: Schmerz gleich hier angeben). Bildschirm bleibt an; Zeit läuft über Zeitstempel weiter (auch im Hintergrund).
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { buildPhases, timedSeconds, type Phase } from '@/lib/routinePlayer';
import { painOn, tracksPain } from '@/lib/routines';
import { techniqueFor } from '@/lib/figure';
import { countdownTick, createWakeLock, playRestAlarm, unlockAudio } from '@/lib/feedback';
import { createSignalScheduler } from '@/lib/signals';
import { isNative, setKeepAwake, tap as haptic } from '@/lib/native';
import ExerciseFigure from './ExerciseFigure.vue';
import PainScale from './PainScale.vue';

const app = useAppStore();
const routines = useRoutinesStore();
const { playerId, today } = storeToRefs(routines);
const { settings } = storeToRefs(app);

const r = computed(() => (playerId.value ? routines.byId(playerId.value) ?? null : null));
const phases = ref<Phase[]>([]);
const index = ref(0);
/** Ende der laufenden Timer-Phase (ms) bzw. Restzeit beim Pausieren. */
const endAt = ref<number | null>(null);
const pausedLeft = ref<number | null>(null);
const now = ref(Date.now());
const finished = ref(false);
/** Durchgang, der beim Abschluss abgehakt wurde. */
const marked = ref<{ done: number; total: number } | null>(null);

const phase = computed(() => phases.value[index.value] ?? null);
const step = computed(() => (phase.value && r.value ? r.value.steps[phase.value.step] ?? null : null));
const upcoming = computed(() => {
  for (let i = index.value + 1; i < phases.value.length; i++) if (phases.value[i]!.kind === 'work' && phases.value[i]!.step !== phase.value?.step) return r.value?.steps[phases.value[i]!.step] ?? null;
  return null;
});
const timed = computed(() => phase.value?.seconds != null);
const left = computed(() => {
  if (!timed.value) return 0;
  if (pausedLeft.value != null) return pausedLeft.value;
  return endAt.value ? Math.max(0, endAt.value - now.value) : (phase.value!.seconds! * 1000);
});
const leftSeconds = computed(() => Math.ceil(left.value / 1000));
const RING = 2 * Math.PI * 88;
const ringOffset = computed(() => (timed.value ? RING * (1 - left.value / (phase.value!.seconds! * 1000)) : 0));
const progress = computed(() => (phases.value.length ? Math.round((index.value / phases.value.length) * 100) : 0));
const motion = computed(() => (step.value?.exerciseId != null ? techniqueFor(app.exerciseFor(step.value.exerciseId)).motion : null));
const totalMinutes = computed(() => Math.max(1, Math.round(timedSeconds(phases.value) / 60)));
const stepCount = computed(() => r.value?.steps.length ?? 0);
const paused = computed(() => pausedLeft.value != null);

// ---------- Ablauf ----------

const signal = createSignalScheduler();
const wake = createWakeLock();
let ticker = 0;
let lastTick = 0;

function startPhase(i: number) {
  index.value = i;
  now.value = Date.now();
  pausedLeft.value = null;
  lastTick = 0;
  const p = phases.value[i];
  if (!p) { complete(); return; }
  endAt.value = p.seconds != null ? Date.now() + p.seconds * 1000 : null;
  planSignal();
}

function planSignal() {
  // Vorlauf (3-2-1, Musik leiser) nur vor dem Ende einer Halte-Phase
  const p = phase.value;
  signal.plan(p?.kind === 'work' && endAt.value && !paused.value ? endAt.value : null,
    { sound: settings.value.sound, duck: settings.value.duckMusic, countdown: settings.value.countdown });
}

function next() {
  const p = phase.value;
  if (p?.kind === 'work' && p.seconds != null) {
    playRestAlarm({ sound: settings.value.sound, vibration: settings.value.vibration });
    signal.signalled();
  } else haptic();
  startPhase(index.value + 1);
}

function back() {
  // Zurück zur letzten Arbeits-Phase (Pausen überspringen)
  let i = index.value - 1;
  while (i > 0 && phases.value[i]!.kind !== 'work') i--;
  startPhase(Math.max(0, i));
}

function togglePause() {
  if (!timed.value) return;
  if (paused.value) { endAt.value = Date.now() + pausedLeft.value!; pausedLeft.value = null; }
  else { pausedLeft.value = left.value; endAt.value = null; }
  planSignal();
}

function addTime(seconds: number) {
  if (!timed.value) return;
  if (paused.value) pausedLeft.value! += seconds * 1000;
  else if (endAt.value) endAt.value += seconds * 1000;
  planSignal();
}

function loop() {
  now.value = Date.now();
  const p = phase.value;
  if (p && p.seconds != null && endAt.value && !paused.value) {
    const s = Math.ceil((endAt.value - now.value) / 1000);
    // Leise Ticks vor Seitenwechsel/Pause-Ende (das Ende einer Halte-Phase tickt der Signal-Planer)
    if (p.kind !== 'work' && settings.value.sound && settings.value.countdown && s <= 3 && s >= 1 && s !== lastTick) { lastTick = s; void countdownTick(s); }
    if (now.value >= endAt.value) next();
  }
}

function complete() {
  if (finished.value || !r.value) return;
  finished.value = true;
  endAt.value = null;
  signal.plan(null, { sound: false, duck: false, countdown: false });
  const p = routines.progressOf(r.value);
  const done = Math.min(r.value.timesPerDay, p.countToday + 1);
  if (!p.doneToday) routines.setCount(r.value.clientId, done);
  marked.value = { done: p.doneToday ? p.countToday : done, total: r.value.timesPerDay };
  playRestAlarm({ sound: settings.value.sound, vibration: settings.value.vibration });
}

async function keepAwake(on: boolean) {
  if (isNative()) await setKeepAwake(on).catch(() => undefined);
  else await wake.set(on);
}

watch(playerId, (id) => {
  window.clearInterval(ticker);
  finished.value = false;
  marked.value = null;
  if (!id || !r.value) { signal.plan(null, { sound: false, duck: false, countdown: false }); void keepAwake(false); return; }
  unlockAudio();
  phases.value = buildPhases(r.value.steps);
  startPhase(0);
  ticker = window.setInterval(loop, 200);
  void keepAwake(true);
}, { immediate: true });

onBeforeUnmount(() => { window.clearInterval(ticker); signal.dispose(); void keepAwake(false); });

const painToday = computed(() => (r.value ? painOn(r.value, today.value) : null));
const askPain = computed(() => finished.value && !!r.value && tracksPain(r.value));
function pickPain(n: number) { if (r.value) routines.setPain(r.value.clientId, n); haptic(); }

function close() {
  if (!finished.value && index.value > 0) {
    // Mitten drin: nichts abhaken, einfach beenden
    signal.plan(null, { sound: false, duck: false, countdown: false });
  }
  routines.closePlayer();
}

const sideLabel = (p: Phase) => (p.side === 'left' ? t('routines.player.left') : p.side === 'right' ? t('routines.player.right') : '');
const kindLabel = computed(() => {
  const p = phase.value;
  if (!p) return '';
  if (p.kind === 'rest') return t('routines.player.rest');
  if (p.kind === 'switch') return t('routines.player.switch');
  if (p.kind === 'next') return t('routines.player.prepare');
  return p.sets > 1 ? t('routines.player.set', { n: p.set, total: p.sets }) : t('routines.player.go');
});
const clock = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s));
</script>

<template>
  <transition name="fade">
      <div v-if="r" class="routine-player fixed inset-0 z-[80] flex flex-col" role="dialog" aria-modal="true" :aria-label="r.title" data-test="routine-player" @keydown.esc.stop="close">
          <!-- Kopf: Titel, Schritt x von y, Fortschritt -->
          <header class="flex items-center gap-3 px-5 pb-2" :style="{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }">
              <button type="button" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white" :aria-label="t('routines.player.exit')" data-test="player-close" @click="close">✕</button>
              <div class="min-w-0 flex-1">
                  <p class="truncate text-[10px] font-bold uppercase tracking-label text-accent">{{ r.title }}</p>
                  <p class="font-mono text-[11px] text-slate-400">
                      <template v-if="!finished && phase">{{ t('routines.player.stepOf', { n: phase.step + 1, total: stepCount }) }} · {{ t('routines.player.total', { n: totalMinutes }) }}</template>
                  </p>
              </div>
          </header>
          <div class="mx-5 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="finished ? 100 : progress" aria-valuemin="0" aria-valuemax="100">
              <div class="h-full rounded-full bg-accent transition-all duration-500" :style="{ width: (finished ? 100 : progress) + '%' }"></div>
          </div>

          <!-- Abschluss -->
          <div v-if="finished" class="flex flex-1 flex-col items-center justify-center px-6 text-center" data-test="player-finished">
              <span class="player-done-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  <span class="finish-burst"><i v-for="n in 12" :key="n"></i></span>
              </span>
              <h2 class="display mt-5 text-3xl text-white">{{ t('routines.player.finishTitle') }}</h2>
              <p v-if="marked" class="mt-2 text-sm text-slate-300">{{ t('routines.player.finishText', { done: marked.done, total: marked.total }) }}</p>
              <div v-if="askPain" class="mt-6 w-full max-w-sm text-left">
                  <p class="text-xs font-bold text-white">{{ t('routines.pain.question') }}</p>
                  <PainScale class="mt-2" :model-value="painToday" @pick="pickPain" />
              </div>
              <button type="button" class="btn-primary mt-8 w-full max-w-sm rounded-2xl py-4 text-base" data-test="player-done" @click="routines.closePlayer()">{{ t('routines.player.close') }}</button>
          </div>

          <!-- Laufende Phase -->
          <div v-else-if="phase && step" class="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-4 pt-4 text-center">
              <p class="player-kind" :class="`is-${phase.kind}`" aria-live="polite" data-test="player-kind">{{ kindLabel }}<template v-if="phase.side && phase.kind !== 'rest'"> · {{ sideLabel(phase) }}</template></p>
              <h2 class="display mt-2 break-words text-2xl leading-tight text-white" data-test="player-step">{{ phase.kind === 'next' ? step.name : step.name }}</h2>
              <p v-if="step.dose" class="mt-1 text-sm text-slate-400">{{ step.dose }}</p>

              <div class="relative mt-5 flex items-center justify-center">
                  <ExerciseFigure v-if="motion && phase.kind === 'work'" :motion="motion" :paused="paused" class="fx-stage absolute h-40 w-40 opacity-25" />
                  <svg v-if="timed" class="player-ring" viewBox="0 0 200 200" aria-hidden="true">
                      <circle cx="100" cy="100" r="88" class="player-ring-track" />
                      <circle cx="100" cy="100" r="88" class="player-ring-fill" :class="`is-${phase.kind}`" :style="{ strokeDasharray: RING, strokeDashoffset: ringOffset }" />
                  </svg>
                  <div v-if="timed" class="absolute flex flex-col items-center">
                      <span class="player-time" :class="{ 'is-low': leftSeconds <= 3 && !paused }" role="timer" data-test="player-time">{{ clock(leftSeconds) }}</span>
                      <span v-if="paused" class="text-[11px] font-bold uppercase tracking-label text-slate-400">{{ t('routines.player.paused') }}</span>
                  </div>
                  <div v-else class="player-reps" data-test="player-reps">
                      <span class="player-time">{{ phase.reps ?? '✓' }}</span>
                      <span class="text-xs font-bold uppercase tracking-label text-slate-400">{{ phase.reps ? tn('routines.player.reps', phase.reps) : t('routines.player.noTimer') }}</span>
                  </div>
              </div>

              <p v-if="upcoming && phase.kind !== 'next'" class="mt-5 truncate text-xs text-slate-500">{{ t('routines.player.next') }}: {{ upcoming.name }}</p>
              <button v-if="step.exerciseId != null" type="button" class="routine-link mt-2" @click="app.openExerciseInfo(step.exerciseId, 'overlay')">{{ exerciseName(app.exerciseFor(step.exerciseId) ?? step.exerciseId) }} ▶</button>
          </div>

          <!-- Steuerung -->
          <footer v-if="!finished && phase" class="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
              <button type="button" class="player-ctl" :aria-label="t('routines.player.back')" :disabled="index === 0" data-test="player-back" @click="back">
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg>
              </button>
              <button v-if="timed" type="button" class="btn-primary flex h-14 items-center justify-center gap-2 rounded-2xl text-base" data-test="player-pause" @click="togglePause">
                  {{ paused ? t('routines.player.resume') : t('routines.player.pause') }}
              </button>
              <button v-else type="button" class="btn-primary flex h-14 items-center justify-center gap-2 rounded-2xl text-base" data-test="player-done-step" @click="next">✓ {{ t('routines.player.doneStep') }}</button>
              <button type="button" class="player-ctl" :aria-label="t('routines.player.skip')" data-test="player-skip" @click="next">
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
              </button>
              <button v-if="timed" type="button" class="col-span-3 justify-self-center text-xs font-bold text-slate-400 hover:text-white" data-test="player-plus" @click="addTime(15)">{{ t('routines.player.plus') }}</button>
          </footer>
      </div>
  </transition>
</template>
