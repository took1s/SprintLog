<script setup lang="ts">
// Laufende Einheit als Übungs-Blöcke: jeder Satz eine Zeile, der nächste steht vorausgefüllt bereit (✓ = loggen).
// - Nach dem Satz: RPE/RIR direkt unter der Zeile wählen (ein Tipp, kein Dialog).
// - Satz nach links wischen = löschen (mit Rückgängig).
// - "Fertig" schließt eine Übung ab: kein hängender nächster Satz mehr; automatisch, sobald das Plan-Ziel erfüllt ist.
// - ⋯ öffnet ein Aktions-Sheet (über allen Blöcken, nichts wird verdeckt).
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn, intlLocale } from '@/i18n';
import { dayName, exerciseName, muscleName, noteText, programName } from '@/i18n/content';
import { useAppStore, rpeText, rpeToRir, SET_RPE } from '@/stores/app';
import { useGoalsStore } from '@/stores/goals';
import { useAiStore } from '@/stores/ai';
import ElapsedClock from './ElapsedClock.vue';
import { cardioText, formatClock, formatCompact, formatDate, formatNumber } from '@/lib/format';
import DurationInput from '@/components/DurationInput.vue';
import type { Exercise } from '@/types';
import { prescriptionText } from '@/lib/program';
import { previousForRow } from '@/lib/workout';
import { goalTargetLabel, prescriptionLabel } from '@/lib/goalText';
import type { WorkoutSet } from '@/types';
import SwipeRow from '@/components/workout/SwipeRow.vue';
import DecimalInput from '@/components/DecimalInput.vue';
import { tap } from '@/lib/native';
import { vLongPress, vSheetDrag } from '@/lib/gestures';
import HoldButton from '@/components/HoldButton.vue';
// Erst beim ersten Öffnen laden (Start-Bundle klein halten)
const GymSheet = defineAsyncComponent(() => import('@/components/workout/GymSheet.vue'));
const ExerciseNoteSheet = defineAsyncComponent(() => import('@/components/workout/ExerciseNoteSheet.vue'));

const app = useAppStore();
const goals = useGoalsStore();
const ai = useAiStore();
const { hasSets, isEditing, lastLogged, planProgress, programs, rpePrompt, session, sessionGym, sessionSummary, settings, workoutBlocks, noteSheetFor } = storeToRefs(app);

// Studio der Einheit und KI im Training
const gymOpen = ref(false);
const usedGym = ref(false);
const usedNote = ref(false);
function openGym() { usedGym.value = true; gymOpen.value = true; }
function openNote(id: number) { usedNote.value = true; app.openNoteSheet(id); }
/** Ausgelassen: Grund statt "fertig". */
const reasonText = (r: string | null | undefined) => (r ? t(`exnote.reasons.${r as 'pain'}`) : t('exnote.skipped'));

const isCardio = (ex: Exercise) => ex.trackingType === 'Cardio';
const km = (m: number | null | undefined) => (m ? Math.round((m / 1000) * 100) / 100 : 0);
const {
  abortSession, completeBlock, reorderBlock, deleteSessionSet, dismissRpePrompt, editSessionSet, finishSession, moveBlock, openExerciseInfo, openPicker,
  openReplace, openSetModal, quickLog, removeBlock, startHold, reopenBlock, setGhostValue, setSetRpe, toggleGhostWarmup,
} = app;

const planProgram = computed(() => programs.value.find((p) => p.id === session.value.plan?.programId) ?? null);
const planDay = computed(() => planProgram.value?.days.find((d) => d.id === session.value.plan?.dayId) ?? null);
const planTitle = computed(() => (session.value.plan
  ? (planProgram.value && planDay.value ? dayName(planProgram.value, planDay.value) : session.value.plan.dayName)
  : ''));

// ---------- Drag & Drop: Übung am Griff ziehen ----------
// Pointer Events statt HTML5-Drag (das gibt es auf dem iPhone nicht). Der gezogene Block folgt dem Finger,
// die anderen rücken zur Seite; losgelassen wird die neue Reihenfolge gespeichert.
const GAP = 12; // space-y-3
const drag = ref<{ id: number; from: number; to: number; dy: number; height: number } | null>(null);
let tops: { id: number; top: number; height: number }[] = [];
let startY = 0;
let startScroll = 0;
let lastY = 0;
let raf = 0;

function measure() {
  tops = [...document.querySelectorAll<HTMLElement>('[data-block]')].map((el) => {
    const r = el.getBoundingClientRect();
    return { id: Number(el.dataset.block), top: r.top + window.scrollY, height: r.height };
  });
}

/** iOS: langes Drücken startet sonst Textauswahl/Lupe, bevor das Ziehen beginnt. */
function blockTouchSelect(e: TouchEvent) { if (e.cancelable) e.preventDefault(); }

function startDrag(e: PointerEvent, id: number) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  window.getSelection()?.removeAllRanges();
  document.documentElement.classList.add('is-reordering');
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  measure();
  const from = tops.findIndex((x) => x.id === id);
  if (from < 0) return;
  startY = lastY = e.clientY;
  startScroll = window.scrollY;
  drag.value = { id, from, to: from, dy: 0, height: tops[from].height };
  if (settings.value.vibration) tap();
  raf = requestAnimationFrame(autoScroll);
}

function update() {
  const d = drag.value;
  if (!d) return;
  d.dy = lastY - startY + (window.scrollY - startScroll);
  const self = tops[d.from];
  const center = self.top + d.dy + self.height / 2;
  let to = 0;
  tops.forEach((b, i) => { if (i !== d.from && b.top + b.height / 2 < center) to += 1; });
  if (to !== d.to) { d.to = to; if (settings.value.vibration) tap(); }
}

function moveDrag(e: PointerEvent) {
  if (!drag.value) return;
  lastY = e.clientY;
  update();
}

/** Am Bildschirmrand weiterscrollen, solange gezogen wird. */
function autoScroll() {
  if (!drag.value) return;
  const edge = 90;
  const speed = lastY < edge ? -(edge - lastY) / 6 : lastY > window.innerHeight - edge ? (lastY - (window.innerHeight - edge)) / 6 : 0;
  if (speed) { window.scrollBy(0, speed); update(); }
  raf = requestAnimationFrame(autoScroll);
}

function endDrag() {
  const d = drag.value;
  document.documentElement.classList.remove('is-reordering');
  cancelAnimationFrame(raf);
  drag.value = null;
  if (d && d.to !== d.from) reorderBlock(d.id, d.to);
}

onBeforeUnmount(() => { cancelAnimationFrame(raf); document.documentElement.classList.remove('is-reordering'); });

/** Verschiebung jedes Blocks während des Ziehens. */
function dragStyle(id: number, index: number): Record<string, string> | undefined {
  const d = drag.value;
  if (!d) return undefined;
  if (id === d.id) return { transform: `translate3d(0, ${d.dy}px, 0)` };
  const shift = d.height + GAP;
  if (d.from < d.to && index > d.from && index <= d.to) return { transform: `translate3d(0, ${-shift}px, 0)` };
  if (d.from > d.to && index >= d.to && index < d.from) return { transform: `translate3d(0, ${shift}px, 0)` };
  return { transform: 'translate3d(0, 0, 0)' };
}

/** Gerade geloggter Satz: Zeile leuchtet kurz auf (Rekord in Gold). Nur direkt nach dem Loggen, nicht beim erneuten Öffnen. */
function popClass(index: number) {
  const l = lastLogged.value;
  if (!l || l.index !== index || Date.now() - l.at > 1500) return '';
  return l.pr ? 'set-pr' : 'set-pop';
}

/** Übung, deren Aktions-Sheet offen ist. */
const sheetFor = ref<number | null>(null);
const sheetBlock = computed(() => workoutBlocks.value.find((b) => b.exercise.id === sheetFor.value) ?? null);
const sheetIndex = computed(() => workoutBlocks.value.findIndex((b) => b.exercise.id === sheetFor.value));

/** Aktion ausführen, dann Sheet schließen (Reihenfolge wichtig: die Aktion liest den Block aus dem Sheet). */
function act(fn: () => void) { fn(); sheetFor.value = null; }

const num = (v: number | null | undefined, decimals = 2) => (v == null ? '' : formatNumber(v, decimals));

function prevText(set: WorkoutSet | null, type: string | undefined): string {
  if (!set) return '-';
  if (type === 'Cardio') return cardioText(set, false) || '-';
  if (type === 'DistanceTime') return `${num(set.distance, 1)}·${num(set.time, 2)}`;
  if (type === 'Duration') return `${num(set.time, 0)} ${t('units.s')}`;
  return `${num(set.weight)}×${set.reps ?? '-'}`;
}

/** Nummer eines Satzes innerhalb der Arbeitssätze (Aufwärmsätze heißen "W"). */
function rowLabel(sets: readonly WorkoutSet[], i: number): string {
  if (sets[i]?.isWarmup) return 'W';
  return String(sets.slice(0, i + 1).filter((s) => !s.isWarmup).length);
}

/** Dezimaltrenner der Sprache (für die RIR/RPE-Anzeige). */
const decimalSep = computed(() => (1.5).toLocaleString(intlLocale()).charAt(1));

/** Schnellwahl unter dem Satz: RPE 7-10 (alles darunter ist kein Arbeitssatz - dafür gibt es den Dialog). */
const QUICK_RPE = SET_RPE.filter((r) => r >= 7);

/** RPE-Auswahl als RIR anzeigen, falls eingestellt (gespeichert wird immer RPE). */
const effortLabel = (r: number) => (settings.value.useRir ? String(rpeToRir(r)).replace('.', decimalSep.value) : String(r).replace('.', decimalSep.value));
</script>

<template>
  <section class="mb-8" data-test="workout">
      <!-- Kopf: Dauer, Volumen, Abschließen -->
      <div class="glass-panel mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div class="min-w-0">
              <div class="truncate text-[10px] font-bold uppercase text-accent tracking-label">
                  <template v-if="isEditing">{{ t('workout.editingKicker') }}</template>
                  <template v-else-if="session.plan">{{ planProgram ? programName(planProgram) : session.plan.programName }}</template>
                  <template v-else>{{ t('workout.title') }}</template>
              </div>
              <div class="display truncate text-xl text-white">
                  <template v-if="session.plan">{{ planTitle }}</template>
                  <template v-else-if="isEditing">{{ formatDate(session.meta?.date ?? session.startedAt, { weekday: 'short', day: '2-digit', month: 'short' }) }}</template>
                  <template v-else><ElapsedClock class="font-mono" /></template>
              </div>
              <div class="font-mono text-[11px] text-slate-400">
                  <template v-if="session.plan"><ElapsedClock /> · {{ planProgress.done }}/{{ planProgress.total }} {{ t('plan.sets') }}</template>
                  <template v-else>{{ tn('units.sets', session.sets.length) }}<template v-if="sessionSummary.volume"> · {{ formatCompact(sessionSummary.volume) }} {{ t('units.kg') }}</template></template>
              </div>
          </div>
          <button @click="finishSession" :disabled="!hasSets" data-test="finish-workout" class="btn-primary flex-shrink-0 rounded-xl px-5 py-3 text-sm">
              {{ isEditing ? t('session.save') : t('session.finish') }}
          </button>
      </div>

      <!-- Studio (Rekorde an Maschinen pro Studio) und KI, die das Training sieht und ändern kann -->
      <div class="mb-4 flex items-center gap-2">
          <button type="button" class="workout-chip min-w-0" @click="openGym" data-test="gym-chip" :aria-label="t('gym.choose')">
              <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
              <span class="truncate">{{ sessionGym || t('workout.gymNone') }}</span>
              <svg class="h-3 w-3 flex-shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button v-if="ai.enabled && !isEditing" type="button" class="workout-chip workout-chip-ai ml-auto flex-shrink-0" @click="ai.openChat()" :title="t('workout.askAiHint')" data-test="workout-ai">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>
              {{ t('workout.askAi') }}
          </button>
      </div>

      <div v-if="session.plan" class="mb-4 h-1 overflow-hidden rounded-full bg-white/5" aria-hidden="true">
          <div class="h-full rounded-full bg-accent transition-all" :style="{ width: planProgress.percent + '%' }"></div>
      </div>

      <!-- Übungs-Blöcke -->
      <TransitionGroup name="swap" tag="div" class="space-y-3">
          <article v-for="(block, bi) in workoutBlocks" :key="block.exercise.id" class="glass-panel relative rounded-2xl p-4"
                   :class="drag ? (drag.id === block.exercise.id ? 'z-20 shadow-2xl ring-2 ring-accent/60' : 'transition-transform duration-150 ease-out') : ''"
                   :style="dragStyle(block.exercise.id, bi)" :data-block="block.exercise.id" :data-done="block.done || undefined">
              <header class="mb-2 flex items-start justify-between gap-2">
                  <!-- Antippen = Satz-Dialog, gedrückt halten = Aktions-Menü (wie ein Kontextmenü) -->
                  <button type="button" class="min-w-0 rounded-lg text-left" @click="openSetModal(block.exercise)" v-long-press="() => (sheetFor = block.exercise.id)"
                          :aria-label="t('workout.details', { name: exerciseName(block.exercise) })" data-test="block-title">
                      <div class="flex items-center gap-2">
                          <span v-if="block.done" class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-400" aria-hidden="true">
                              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </span>
                          <h3 class="display line-clamp-2 text-lg text-white">{{ exerciseName(block.exercise) }}</h3>
                      </div>
                      <p class="mt-0.5 truncate font-mono text-xs text-slate-400">
                          <template v-if="block.target">{{ prescriptionText(block.target) }}</template>
                          <template v-else-if="block.previous.length">{{ t('workout.lastTime', { value: prevText(block.previous.filter((s) => !s.isWarmup).at(-1) ?? block.previous.at(-1) ?? null, block.exercise.trackingType), sets: tn('units.sets', block.previous.filter((s) => !s.isWarmup).length) }) }}</template>
                          <template v-else>{{ muscleName(block.exercise.muscleGroup) }} · {{ t('workout.firstTime') }}</template>
                      </p>
                      <p v-if="block.target?.note" class="truncate font-mono text-[10px] text-accent">{{ noteText(block.target.note) }}</p>
                      <p v-if="block.target?.replacedFrom" class="truncate font-mono text-[10px] text-slate-500">{{ t('workout.insteadOf', { name: exerciseName(null, block.target.replacedFrom) }) }}</p>
                      <!-- Kraft-Ziel: Vorgabe für heute -->
                      <p v-if="block.goal && !block.target" class="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[11px]" :class="block.goal.progress.achieved ? 'text-yellow-400' : 'text-accent'" data-test="block-goal">
                          <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.5"/></svg>
                          <span class="truncate">{{ goalTargetLabel(block.goal.goal) }} · {{ prescriptionLabel(block.goal.next, block.goal.goal) }}</span>
                      </p>
                      <!-- Eigenschaften der Übung: Hilfe statt Last, Werte pro Seite -->
                      <p v-if="block.exercise.isAssisted || block.exercise.perSide" class="mt-1 flex flex-wrap gap-1.5">
                          <span v-if="block.exercise.isAssisted" class="ex-tag" data-test="tag-assisted">{{ t('workout.assisted') }}</span>
                          <span v-if="block.exercise.perSide" class="ex-tag" data-test="tag-per-side">{{ t('workout.perSide') }}</span>
                      </p>
                      <p v-if="block.hint" class="mt-1 line-clamp-2 text-[11px] leading-snug text-accent" data-test="block-hint">✦ {{ block.hint }}</p>
                      <p v-if="block.note && (block.note.note || block.note.reason) && !block.note.skipped" class="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-300" data-test="block-note">
                          ✎ <template v-if="block.note.reason">{{ reasonText(block.note.reason) }}<template v-if="block.note.note"> · </template></template>{{ block.note.note }}
                      </p>
                  </button>
                  <div class="-mr-2 flex flex-shrink-0 items-start">
                  <!-- Griff: gedrückt halten und ziehen -->
                  <button v-if="workoutBlocks.length > 1" type="button" class="drag-handle -mt-1 flex h-11 w-11 flex-shrink-0 cursor-grab items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white active:cursor-grabbing"
                          :aria-label="t('workout.dragHandle')" data-test="drag-handle"
                          @pointerdown="startDrag($event, block.exercise.id)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag"
                          @touchstart="blockTouchSelect" @contextmenu.prevent @selectstart.prevent>
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
                  </button>
                  <button type="button" @click="sheetFor = block.exercise.id"
                          class="-mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white" :aria-label="t('workout.menu')" aria-haspopup="dialog">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                  </button>
                  </div>
              </header>

              <!-- Tabelle: # | vorher | Werte | ✓ -->
              <div class="grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-x-2 px-1 pb-1 text-[10px] font-bold uppercase text-slate-500 tracking-label" aria-hidden="true">
                  <span>{{ t('workout.col.set') }}</span>
                  <span>{{ t('workout.col.previous') }}</span>
                  <template v-if="block.exercise.trackingType === 'DistanceTime'"><span class="text-center">{{ t('units.m') }}</span><span class="text-center">{{ t('units.s') }}</span></template>
                  <template v-else-if="block.exercise.trackingType === 'Duration'"><span></span><span class="text-center">{{ t('units.s') }}</span></template>
                  <template v-else-if="isCardio(block.exercise)"><span class="text-center">{{ t('workout.col.time') }}</span><span class="text-center">{{ t('workout.col.km') }}</span></template>
                  <template v-else><span class="truncate text-center">{{ block.exercise.isAssisted ? t('workout.col.assist') : t('units.kg') }}</span><span class="text-center">{{ t('workout.col.reps') }}</span></template>
                  <span></span>
              </div>

              <!-- Erledigte Sätze: antippen = bearbeiten, nach links wischen = löschen -->
              <template v-for="(set, si) in block.sets" :key="set.index">
                  <SwipeRow :label="t('workout.deleteSet')" @tap="editSessionSet(set.index)" @delete="deleteSessionSet(set.index)">
                      <button type="button" class="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-x-2 px-1 py-1.5 text-left transition-colors hover:bg-white/5"
                              :class="popClass(set.index)" :aria-label="t('workout.editSet', { n: rowLabel(block.sets, si) })" data-test="set-row">
                          <span class="text-center font-mono text-xs font-bold" :class="set.isWarmup ? 'text-orange-400' : 'text-slate-400'">{{ rowLabel(block.sets, si) }}</span>
                          <span class="truncate font-mono text-[11px] text-slate-500">
                              {{ prevText(set.isWarmup ? null : previousForRow(block.previous, block.sets.slice(0, si).filter((s) => !s.isWarmup).length), block.exercise.trackingType) }}
                              <template v-if="set.rpe != null"> · <span class="text-orange-300">{{ rpeText(set.rpe, settings.useRir) }}</span></template>
                              <template v-if="set.note"> · ✎</template>
                          </span>
                          <template v-if="block.exercise.trackingType === 'DistanceTime'">
                              <span class="text-center font-mono text-base font-bold text-white">{{ num(set.distance, 1) }}</span>
                              <span class="text-center font-mono text-base font-bold text-white">{{ num(set.time, 2) }}</span>
                          </template>
                          <template v-else-if="block.exercise.trackingType === 'Duration'">
                              <span></span><span class="text-center font-mono text-base font-bold text-white">{{ num(set.time, 0) }}</span>
                          </template>
                          <template v-else-if="isCardio(block.exercise)">
                              <span class="text-center font-mono text-base font-bold text-white">{{ set.time ? formatClock(set.time) : '-' }}</span>
                              <span class="text-center font-mono text-base font-bold text-white">{{ set.distance ? num(km(set.distance)) : '-' }}</span>
                          </template>
                          <template v-else>
                              <span class="text-center font-mono text-base font-bold text-white">{{ (set.weight ?? 0) > 0 ? num(set.weight) : t('workout.bw') }}</span>
                              <span class="text-center font-mono text-base font-bold text-white">{{ set.reps }}</span>
                          </template>
                          <span class="mr-1.5 flex h-7 w-7 items-center justify-center justify-self-end rounded-md bg-emerald-400/15 text-emerald-400" aria-hidden="true">
                              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </span>
                      </button>
                  </SwipeRow>

                  <!-- Wie schwer war's? Direkt unter dem gerade geloggten Satz -->
                  <transition name="fade">
                      <div v-if="rpePrompt?.index === set.index" class="my-1 flex items-center gap-1 rounded-xl bg-white/[0.04] py-1 pl-2 pr-1" role="group" :aria-label="settings.useRir ? t('workout.rirAsk') : t('workout.rpeAsk')" data-test="rpe-strip">
                          <span class="mr-1 flex-shrink-0 text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ settings.useRir ? t('set.rir') : t('set.rpe') }}</span>
                          <div class="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
                              <button v-for="r in QUICK_RPE" :key="r" type="button" @click="setSetRpe(set.index, r)" :data-rpe="r"
                                      class="h-10 min-w-0 rounded-lg font-mono text-[13px] font-bold text-slate-200 transition-colors hover:bg-orange-400/15 hover:text-orange-300 active:scale-95">
                                  {{ effortLabel(r) }}
                              </button>
                          </div>
                          <button type="button" @click="dismissRpePrompt" class="flex h-10 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-white" :aria-label="t('workout.rpeSkip')">✕</button>
                      </div>
                  </transition>
              </template>

              <!-- Nächster Satz (vorausgefüllt) - nur solange die Übung offen ist -->
              <template v-if="!block.done">
                  <div class="mt-1 grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-x-2 rounded-xl bg-accent/5 px-1 py-1.5 ring-1 ring-inset ring-accent/25" data-test="ghost-row">
                      <button type="button" @click="toggleGhostWarmup(block.exercise.id)"
                              class="h-11 w-11 rounded-lg font-mono text-sm font-bold transition-colors"
                              :class="block.ghost.isWarmup ? 'bg-orange-400/15 text-orange-400' : 'text-slate-400 hover:bg-white/5'"
                              :aria-pressed="block.ghost.isWarmup" :aria-label="t('workout.toggleWarmup')">
                          {{ block.ghost.isWarmup ? 'W' : block.workingDone + 1 }}
                      </button>
                      <span class="truncate font-mono text-[11px] text-slate-500">{{ prevText(block.ghost.isWarmup ? null : previousForRow(block.previous, block.workingDone), block.exercise.trackingType) }}</span>
                      <template v-if="block.exercise.trackingType === 'DistanceTime'">
                          <DecimalInput :model-value="block.ghost.distance" @update:model-value="setGhostValue(block.exercise.id, 'distance', $event ?? 0)" select-on-focus
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.m')" />
                          <DecimalInput :model-value="block.ghost.time" @update:model-value="setGhostValue(block.exercise.id, 'time', $event ?? 0)" select-on-focus
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.s')" />
                      </template>
                      <template v-else-if="block.exercise.trackingType === 'Duration'">
                          <!-- Timer starten: zählt die geplante Zeit herunter und loggt den Satz -->
                          <button type="button" @click="startHold(block.exercise.id)" data-test="start-hold"
                                  class="btn-secondary flex h-11 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-black uppercase tracking-label"
                                  :aria-label="t('hold.start', { name: exerciseName(block.exercise) })">
                              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
                              {{ t('hold.go') }}
                          </button>
                          <DecimalInput :model-value="block.ghost.time" @update:model-value="setGhostValue(block.exercise.id, 'time', $event ?? 0)" select-on-focus integer
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.s')" />
                      </template>
                      <template v-else-if="isCardio(block.exercise)">
                          <DurationInput :model-value="block.ghost.time" @update:model-value="setGhostValue(block.exercise.id, 'time', $event ?? 0)"
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('cardio.durationInput')" data-test="ghost-time" />
                          <DecimalInput :model-value="km(block.ghost.distance)" @update:model-value="setGhostValue(block.exercise.id, 'distance', Math.round(($event ?? 0) * 1000))" select-on-focus
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('cardio.distance')" data-test="ghost-km" />
                      </template>
                      <template v-else>
                          <DecimalInput :model-value="block.ghost.weight" @update:model-value="setGhostValue(block.exercise.id, 'weight', $event ?? 0)" select-on-focus
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.kg')" data-test="ghost-weight" />
                          <DecimalInput :model-value="block.ghost.reps" @update:model-value="setGhostValue(block.exercise.id, 'reps', $event ?? 0)" select-on-focus integer
                                 class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('workout.col.reps')" data-test="ghost-reps" />
                      </template>
                      <button type="button" @click="quickLog(block.exercise.id)" data-test="log-ghost"
                              class="flex h-11 w-11 items-center justify-center justify-self-end rounded-lg bg-accent text-on-accent shadow-glow transition-transform hover:brightness-105 active:scale-90"
                              :aria-label="t('workout.logSet', { name: exerciseName(block.exercise) })">
                          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </button>
                  </div>
                  <button v-if="isCardio(block.exercise)" type="button" @click="openSetModal(block.exercise)" data-test="cardio-more"
                          class="mt-1 flex min-h-[2.75rem] w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-bold uppercase text-accent tracking-label hover:bg-accent/5">
                      <span aria-hidden="true">+</span> {{ t('workout.cardioMore') }}
                  </button>
                  <div v-if="block.workingDone || block.target?.sets" class="mt-1 flex min-h-[2.75rem] items-center justify-between gap-2 px-1">
                      <span class="font-mono text-[10px]" :class="block.target?.sets && block.workingDone >= block.target.sets ? 'text-emerald-400' : 'text-slate-500'">
                          <template v-if="block.target?.sets">{{ t('workout.planProgress', { done: Math.min(block.workingDone, block.target.sets), total: block.target.sets }) }}</template>
                      </span>
                      <button v-if="block.workingDone" type="button" @click="completeBlock(block.exercise.id)" data-test="complete-block"
                              class="flex min-h-[2.75rem] items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold uppercase text-slate-400 tracking-label hover:bg-white/5 hover:text-emerald-400">
                          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                          {{ t('workout.complete') }}
                      </button>
                  </div>
              </template>

              <!-- Abgeschlossen: Zusammenfassung + "Satz hinzufügen" -->
              <div v-else class="mt-1 flex min-h-[2.75rem] items-center justify-between gap-2 border-t border-white/5 px-1 pt-1">
                  <button v-if="block.note?.skipped" type="button" class="min-w-0 text-left" @click="openNote(block.exercise.id)" data-test="block-skipped">
                      <span class="block truncate font-mono text-[11px] text-orange-300">{{ t('workout.skippedLine', { reason: reasonText(block.note.reason) }) }}</span>
                      <span v-if="block.note.note" class="block truncate text-[11px] text-slate-400">{{ block.note.note }}</span>
                  </button>
                  <span v-else class="font-mono text-[11px] text-emerald-400">{{ t('workout.completed') }} · {{ tn('units.sets', block.workingDone) }}</span>
                  <button type="button" @click="reopenBlock(block.exercise.id)" data-test="reopen-block"
                          class="flex min-h-[2.75rem] flex-shrink-0 items-center rounded-lg px-3 text-[11px] font-bold uppercase text-accent tracking-label hover:bg-accent/10">
                      + {{ t('workout.addSet') }}
                  </button>
              </div>
          </article>
      </TransitionGroup>

      <button type="button" @click="openPicker" data-test="add-exercise"
              class="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 py-4 text-sm font-bold text-accent transition-colors hover:bg-accent/5">
          <span class="text-lg leading-none">+</span> {{ t('workout.addExercise') }}
      </button>

      <div class="mt-4 flex justify-center">
          <!-- Verwerfen nur per Gedrückthalten - kein versehentlicher Verlust einer ganzen Einheit -->
          <HoldButton :label="isEditing ? t('workout.discardChanges') : t('workout.discard')" @confirm="abortSession({ confirmed: true })" @fallback="abortSession()"
                      class="min-h-[2.75rem] rounded-xl px-4 py-2 text-[11px] font-bold uppercase text-slate-500 hover:text-red-400 tracking-label" data-test="discard-session" />
      </div>

      <!-- Aktions-Sheet einer Übung: liegt über allem (Teleport), damit kein anderer Block es verdeckt -->
      <Teleport to="body">
          <transition name="sheet">
              <div v-if="sheetBlock" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center" @click.self="sheetFor = null" data-test="block-sheet">
                  <div v-sheet-drag="() => (sheetFor = null)" class="glass-panel modal-panel w-full max-w-md overflow-hidden rounded-t-3xl pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="exerciseName(sheetBlock.exercise)">
                      <div class="px-6 pb-2 pt-6">
                          <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ muscleName(sheetBlock.exercise.muscleGroup) }} · {{ tn('units.sets', sheetBlock.sets.length) }}</p>
                          <h2 class="display truncate text-xl text-white">{{ exerciseName(sheetBlock.exercise) }}</h2>
                      </div>
                      <nav class="px-3 pb-2" role="menu">
                          <button role="menuitem" class="sheet-item" @click="act(() => openExerciseInfo(sheetBlock!.exercise.id, 'workout'))">
                              <span>{{ t('workout.info') }}</span><span class="sheet-hint">{{ t('workout.infoHint') }}</span>
                          </button>
                          <button role="menuitem" class="sheet-item" @click="act(() => openSetModal(sheetBlock!.exercise))">
                              <span>{{ t('workout.detailedSet') }}</span><span class="sheet-hint">{{ t('workout.detailedSetHint') }}</span>
                          </button>
                          <button role="menuitem" class="sheet-item" @click="act(() => openNote(sheetBlock!.exercise.id))" data-test="sheet-note">
                              <span>{{ t('workout.noteMenu') }}</span><span class="sheet-hint">{{ t('workout.noteMenuHint') }}</span>
                          </button>
                          <button v-if="(sheetBlock.exercise.trackingType ?? 'WeightReps') === 'WeightReps'" role="menuitem" class="sheet-item" @click="act(() => goals.openGoal(sheetBlock!.exercise.id))">
                              <span>{{ sheetBlock.goal ? t('goals.editGoal') : t('goals.setGoal') }}</span>
                              <span class="sheet-hint">{{ sheetBlock.goal ? goalTargetLabel(sheetBlock.goal.goal) : t('goals.setGoalHint') }}</span>
                          </button>
                          <button role="menuitem" class="sheet-item" @click="act(() => openReplace(sheetBlock!.exercise.id))" data-test="sheet-replace">
                              <span>{{ t('workout.replace') }}</span><span class="sheet-hint">{{ t('workout.replaceHint') }}</span>
                          </button>
                          <button v-if="sheetBlock.done" role="menuitem" class="sheet-item" @click="act(() => reopenBlock(sheetBlock!.exercise.id))">{{ t('workout.reopen') }}</button>
                          <button v-else-if="sheetBlock.workingDone" role="menuitem" class="sheet-item" @click="act(() => completeBlock(sheetBlock!.exercise.id))">{{ t('workout.complete') }}</button>
                          <div class="grid grid-cols-2 gap-2 px-1 py-1">
                              <button role="menuitem" class="btn-ghost rounded-xl py-3 text-sm" :disabled="sheetIndex <= 0" @click="act(() => moveBlock(sheetBlock!.exercise.id, -1))">↑ {{ t('workout.moveUp') }}</button>
                              <button role="menuitem" class="btn-ghost rounded-xl py-3 text-sm" :disabled="sheetIndex >= workoutBlocks.length - 1" @click="act(() => moveBlock(sheetBlock!.exercise.id, 1))">↓ {{ t('workout.moveDown') }}</button>
                          </div>
                          <button role="menuitem" class="sheet-item text-red-400" @click="act(() => removeBlock(sheetBlock!.exercise.id))" data-test="sheet-remove">{{ t('workout.remove') }}</button>
                      </nav>
                  </div>
              </div>
          </transition>
      </Teleport>
      <GymSheet v-if="usedGym" :open="gymOpen" @close="gymOpen = false" />
      <ExerciseNoteSheet v-if="usedNote || noteSheetFor != null" />
  </section>
</template>
