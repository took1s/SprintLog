<script setup lang="ts">
// Laufende Einheit als Übungs-Blöcke: jeder Satz eine Zeile, der nächste steht vorausgefüllt bereit (✓ = loggen).
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn, intlLocale } from '@/i18n';
import { dayName, exerciseName, muscleName, noteText, programName } from '@/i18n/content';
import { useAppStore, rpeText } from '@/stores/app';
import { formatClock, formatCompact, formatDate, formatNumber } from '@/lib/format';
import { prescriptionText } from '@/lib/program';
import { previousForRow } from '@/lib/workout';
import type { WorkoutSet } from '@/types';

const app = useAppStore();
const { hasSets, isEditing, planProgress, programs, session, sessionElapsed, sessionSummary, settings, workoutBlocks } = storeToRefs(app);
const { abortSession, editSessionSet, finishSession, moveBlock, openPicker, openSetModal, quickLog, removeBlock, setGhostValue, toggleGhostWarmup } = app;

const planProgram = computed(() => programs.value.find((p) => p.id === session.value.plan?.programId) ?? null);
const planDay = computed(() => planProgram.value?.days.find((d) => d.id === session.value.plan?.dayId) ?? null);
const planTitle = computed(() => (session.value.plan
  ? (planProgram.value && planDay.value ? dayName(planProgram.value, planDay.value) : session.value.plan.dayName)
  : ''));

/** Geöffnetes ⋯-Menü (Übungs-ID). */
const menuFor = ref<number | null>(null);

const num = (v: number | null | undefined, decimals = 2) => (v == null ? '' : formatNumber(v, decimals));

function prevText(set: WorkoutSet | null, type: string | undefined): string {
  if (!set) return '-';
  if (type === 'DistanceTime') return `${num(set.distance, 1)}·${num(set.time, 2)}`;
  if (type === 'Duration') return `${num(set.time, 0)}s`;
  return `${num(set.weight)}×${set.reps ?? '-'}`;
}

/** Nummer eines Satzes innerhalb der Arbeitssätze (Aufwärmsätze heißen "W"). */
function rowLabel(sets: readonly WorkoutSet[], i: number): string {
  if (sets[i]?.isWarmup) return 'W';
  return String(sets.slice(0, i + 1).filter((s) => !s.isWarmup).length);
}

/** Wert für ein Eingabefeld mit dem Dezimaltrenner der Sprache (Parser akzeptiert . und ,). */
const decimalSep = computed(() => (1.5).toLocaleString(intlLocale()).charAt(1));
const inputValue = (v: number) => String(Math.round(v * 100) / 100).replace('.', decimalSep.value);

function selectAll(e: FocusEvent) { (e.target as HTMLInputElement | null)?.select(); }
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
                  <template v-else><span class="font-mono">{{ formatClock(sessionElapsed) }}</span></template>
              </div>
              <div class="font-mono text-[11px] text-slate-400">
                  <template v-if="session.plan">{{ formatClock(sessionElapsed) }} · {{ planProgress.done }}/{{ planProgress.total }} {{ t('plan.sets') }}</template>
                  <template v-else>{{ tn('units.sets', session.sets.length) }}<template v-if="sessionSummary.volume"> · {{ formatCompact(sessionSummary.volume) }} {{ t('units.kg') }}</template></template>
              </div>
          </div>
          <button @click="finishSession" :disabled="!hasSets" data-test="finish-workout" class="btn-primary flex-shrink-0 rounded-xl px-5 py-3 text-sm">
              {{ isEditing ? t('session.save') : t('session.finish') }}
          </button>
      </div>

      <div v-if="session.plan" class="mb-4 h-1 overflow-hidden rounded-full bg-white/5" aria-hidden="true">
          <div class="h-full rounded-full bg-accent transition-all" :style="{ width: planProgress.percent + '%' }"></div>
      </div>

      <!-- Übungs-Blöcke -->
      <TransitionGroup name="swap" tag="div" class="space-y-3">
          <article v-for="(block, bi) in workoutBlocks" :key="block.exercise.id" class="glass-panel rounded-2xl p-4" :data-block="block.exercise.id">
              <header class="mb-2 flex items-start justify-between gap-2">
                  <button type="button" class="min-w-0 text-left" @click="openSetModal(block.exercise)" :aria-label="t('workout.details', { name: exerciseName(block.exercise) })">
                      <h3 class="display line-clamp-2 text-lg text-white">{{ exerciseName(block.exercise) }}</h3>
                      <p class="mt-0.5 truncate font-mono text-xs text-slate-400">
                          <template v-if="block.target">{{ prescriptionText(block.target) }}</template>
                          <template v-else-if="block.previous.length">{{ t('workout.lastTime', { value: prevText(block.previous.filter((s) => !s.isWarmup).at(-1) ?? block.previous.at(-1) ?? null, block.exercise.trackingType), sets: block.previous.filter((s) => !s.isWarmup).length }) }}</template>
                          <template v-else>{{ muscleName(block.exercise.muscleGroup) }} · {{ t('workout.firstTime') }}</template>
                      </p>
                      <p v-if="block.target?.note" class="truncate font-mono text-[10px] text-accent">{{ noteText(block.target.note) }}</p>
                  </button>
                  <div class="relative flex-shrink-0">
                      <button type="button" @click="menuFor = menuFor === block.exercise.id ? null : block.exercise.id"
                              class="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white" :aria-label="t('workout.menu')" :aria-expanded="menuFor === block.exercise.id">
                          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                      </button>
                      <div v-if="menuFor === block.exercise.id" class="fixed inset-0 z-20" @click="menuFor = null"></div>
                      <div v-if="menuFor === block.exercise.id" class="modal-panel glass-panel absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-xl py-1 text-sm" role="menu">
                          <button role="menuitem" class="block w-full px-4 py-2.5 text-left text-slate-200 hover:bg-white/5" @click="menuFor = null; openSetModal(block.exercise)">{{ t('workout.technique') }}</button>
                          <button v-if="bi > 0" role="menuitem" class="block w-full px-4 py-2.5 text-left text-slate-200 hover:bg-white/5" @click="menuFor = null; moveBlock(block.exercise.id, -1)">{{ t('workout.moveUp') }}</button>
                          <button v-if="bi < workoutBlocks.length - 1" role="menuitem" class="block w-full px-4 py-2.5 text-left text-slate-200 hover:bg-white/5" @click="menuFor = null; moveBlock(block.exercise.id, 1)">{{ t('workout.moveDown') }}</button>
                          <button role="menuitem" class="block w-full px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10" @click="menuFor = null; removeBlock(block.exercise.id)">{{ t('workout.remove') }}</button>
                      </div>
                  </div>
              </header>

              <!-- Tabelle: # | vorher | Werte | ✓ -->
              <div class="grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-x-2 px-1 pb-1 text-[10px] font-bold uppercase text-slate-500 tracking-label" aria-hidden="true">
                  <span>{{ t('workout.col.set') }}</span>
                  <span>{{ t('workout.col.previous') }}</span>
                  <template v-if="block.exercise.trackingType === 'DistanceTime'"><span class="text-center">{{ t('units.m') }}</span><span class="text-center">{{ t('units.s') }}</span></template>
                  <template v-else-if="block.exercise.trackingType === 'Duration'"><span></span><span class="text-center">{{ t('units.s') }}</span></template>
                  <template v-else><span class="text-center">{{ t('units.kg') }}</span><span class="text-center">{{ t('workout.col.reps') }}</span></template>
                  <span></span>
              </div>

              <!-- Erledigte Sätze: antippen = bearbeiten -->
              <button v-for="(set, si) in block.sets" :key="set.index" type="button" @click="editSessionSet(set.index)"
                      class="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-x-2 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/5"
                      :aria-label="t('workout.editSet', { n: rowLabel(block.sets, si) })">
                  <span class="text-center font-mono text-xs font-bold" :class="set.isWarmup ? 'text-orange-400' : 'text-slate-400'">{{ rowLabel(block.sets, si) }}</span>
                  <span class="truncate font-mono text-[11px] text-slate-500">
                      {{ prevText(set.isWarmup ? null : previousForRow(block.previous, block.sets.slice(0, si).filter((s) => !s.isWarmup).length), block.exercise.trackingType) }}
                      <template v-if="set.rpe != null"> · {{ rpeText(set.rpe, settings.useRir) }}</template>
                      <template v-if="set.note"> · ✎</template>
                  </span>
                  <template v-if="block.exercise.trackingType === 'DistanceTime'">
                      <span class="text-center font-mono text-base font-bold text-white">{{ num(set.distance, 1) }}</span>
                      <span class="text-center font-mono text-base font-bold text-white">{{ num(set.time, 2) }}</span>
                  </template>
                  <template v-else-if="block.exercise.trackingType === 'Duration'">
                      <span></span><span class="text-center font-mono text-base font-bold text-white">{{ num(set.time, 0) }}</span>
                  </template>
                  <template v-else>
                      <span class="text-center font-mono text-base font-bold text-white">{{ (set.weight ?? 0) > 0 ? num(set.weight) : t('workout.bw') }}</span>
                      <span class="text-center font-mono text-base font-bold text-white">{{ set.reps }}</span>
                  </template>
                  <span class="mr-1.5 flex h-7 w-7 items-center justify-center justify-self-end rounded-md bg-emerald-400/15 text-emerald-400" aria-hidden="true">
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </span>
              </button>

              <!-- Nächster Satz (vorausgefüllt) -->
              <div class="mt-1 grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.5rem_3rem] items-center gap-x-2 rounded-xl bg-accent/5 px-1 py-1.5 ring-1 ring-inset ring-accent/25" data-test="ghost-row">
                  <button type="button" @click="toggleGhostWarmup(block.exercise.id)"
                          class="h-11 w-11 rounded-lg font-mono text-sm font-bold transition-colors"
                          :class="block.ghost.isWarmup ? 'bg-orange-400/15 text-orange-400' : 'text-slate-400 hover:bg-white/5'"
                          :aria-pressed="block.ghost.isWarmup" :aria-label="t('workout.toggleWarmup')">
                      {{ block.ghost.isWarmup ? 'W' : block.workingDone + 1 }}
                  </button>
                  <span class="truncate font-mono text-[11px] text-slate-500">{{ prevText(block.ghost.isWarmup ? null : previousForRow(block.previous, block.workingDone), block.exercise.trackingType) }}</span>
                  <template v-if="block.exercise.trackingType === 'DistanceTime'">
                      <input :value="inputValue(block.ghost.distance)" @input="setGhostValue(block.exercise.id, 'distance', ($event.target as HTMLInputElement).value)" @focus="selectAll"
                             inputmode="decimal" type="text" class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.m')">
                      <input :value="inputValue(block.ghost.time)" @input="setGhostValue(block.exercise.id, 'time', ($event.target as HTMLInputElement).value)" @focus="selectAll"
                             inputmode="decimal" type="text" class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.s')">
                  </template>
                  <template v-else-if="block.exercise.trackingType === 'Duration'">
                      <span></span>
                      <input :value="inputValue(block.ghost.time)" @input="setGhostValue(block.exercise.id, 'time', ($event.target as HTMLInputElement).value)" @focus="selectAll"
                             inputmode="numeric" type="text" class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.s')">
                  </template>
                  <template v-else>
                      <input :value="inputValue(block.ghost.weight)" @input="setGhostValue(block.exercise.id, 'weight', ($event.target as HTMLInputElement).value)" @focus="selectAll"
                             inputmode="decimal" type="text" class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('units.kg')" data-test="ghost-weight">
                      <input :value="inputValue(block.ghost.reps)" @input="setGhostValue(block.exercise.id, 'reps', ($event.target as HTMLInputElement).value)" @focus="selectAll"
                             inputmode="numeric" type="text" class="field h-11 w-full rounded-lg text-center font-mono text-base font-bold" :aria-label="t('workout.col.reps')" data-test="ghost-reps">
                  </template>
                  <button type="button" @click="quickLog(block.exercise.id)" data-test="log-ghost"
                          class="flex h-11 w-11 items-center justify-center justify-self-end rounded-lg bg-accent text-on-accent shadow-glow transition-transform hover:brightness-105 active:scale-90"
                          :aria-label="t('workout.logSet', { name: exerciseName(block.exercise) })">
                      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </button>
              </div>
              <p v-if="block.target && block.target.sets" class="mt-1 px-1 font-mono text-[10px]" :class="block.workingDone >= block.target.sets ? 'text-emerald-400' : 'text-slate-500'">
                  {{ t('workout.planProgress', { done: Math.min(block.workingDone, block.target.sets), total: block.target.sets }) }}
              </p>
          </article>
      </TransitionGroup>

      <button type="button" @click="openPicker" data-test="add-exercise"
              class="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/40 py-4 text-sm font-bold text-accent transition-colors hover:bg-accent/5">
          <span class="text-lg leading-none">+</span> {{ t('workout.addExercise') }}
      </button>

      <div class="mt-4 flex justify-center">
          <button type="button" @click="abortSession" class="px-3 py-2 text-[11px] font-bold uppercase text-slate-500 hover:text-red-400 tracking-label">
              {{ isEditing ? t('workout.discardChanges') : t('workout.discard') }}
          </button>
      </div>
  </section>
</template>
