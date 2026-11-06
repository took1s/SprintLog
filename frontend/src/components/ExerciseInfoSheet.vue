<script setup lang="ts">
// Info-Seite einer Übung: Animation + Technik, eigene Werte, Kraft-Ziel. Aus Picker, Einheit und Katalog erreichbar.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { exerciseName, muscleName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { useGoalsStore } from '@/stores/goals';
import { techniqueFor } from '@/lib/figure';
import { localizedTechnique } from '@/i18n/techniqueText';
import { formatNumber } from '@/lib/format';
import { etaLabel, goalTargetLabel, prescriptionLabel } from '@/lib/goalText';
import ExerciseFigure from '@/components/ExerciseFigure.vue';
import { vSheetDrag } from '@/lib/gestures';

const app = useAppStore();
const goals = useGoalsStore();
const { exerciseInfo, picker, records, workoutBlocks } = storeToRefs(app);
const { closeExerciseInfo, exerciseFor, lastSetLabel, togglePicked } = app;

const ex = computed(() => (exerciseInfo.value ? exerciseFor(exerciseInfo.value.id) : null));
const technique = computed(() => {
  const info = techniqueFor(ex.value);
  return { ...info, technique: localizedTechnique(info.key, info.technique) };
});
const record = computed(() => (ex.value ? records.value.get(`id:${ex.value.id}`) ?? null : null));
const isWeight = computed(() => (ex.value?.trackingType ?? 'WeightReps') === 'WeightReps');
const goalView = computed(() => (ex.value ? goals.viewFor(ex.value.id) : null));
const inWorkout = computed(() => !!ex.value && workoutBlocks.value.some((b) => b.exercise.id === ex.value!.id));
const selected = computed(() => !!ex.value && picker.value.selected.includes(ex.value.id));
const fromPicker = computed(() => exerciseInfo.value?.source === 'picker' && picker.value.open);

function pick() {
  if (!ex.value) return;
  togglePicked(ex.value.id);
  if (!selected.value) return;
  closeExerciseInfo();
}

function goal() {
  if (ex.value) goals.openGoal(ex.value.id);
}
</script>

<template>
  <transition name="sheet">
      <div v-if="ex" class="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="closeExerciseInfo">
          <div v-sheet-drag="closeExerciseInfo" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="exerciseName(ex)" data-test="exercise-info">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ muscleName(ex.muscleGroup) }} · {{ t(`tracking.${ex.trackingType}`) }}</p>
                      <h2 class="display mt-1 text-2xl leading-tight text-white">{{ exerciseName(ex) }}</h2>
                  </div>
                  <button type="button" @click="closeExerciseInfo" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 overflow-y-auto px-6 pb-6">
                  <!-- Eigene Übung: Eigenschaften nachträglich setzen (z. B. "Gravitron" = Hilfe, weniger ist besser) -->
                  <div v-if="ex.isCustom" class="mb-4 space-y-2" data-test="info-flags">
                      <label v-if="isWeight" class="flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                          <input type="checkbox" class="h-5 w-5 flex-shrink-0" :checked="!!ex.isAssisted" @change="app.updateExerciseFlags(ex!, { isAssisted: ($event.target as HTMLInputElement).checked })" data-test="info-assisted" />
                          <span class="text-sm text-slate-200">{{ t('workout.assisted') }}</span>
                      </label>
                      <label class="flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                          <input type="checkbox" class="h-5 w-5 flex-shrink-0" :checked="!!ex.perSide" @change="app.updateExerciseFlags(ex!, { perSide: ($event.target as HTMLInputElement).checked })" data-test="info-per-side" />
                          <span class="text-sm text-slate-200">{{ t('workout.perSide') }}</span>
                      </label>
                  </div>
                  <!-- Technik -->
                  <div v-if="technique.motion || technique.technique" class="overflow-hidden rounded-2xl border border-white/5 bg-black/30">
                      <ExerciseFigure v-if="technique.motion" :motion="technique.motion" class="fx-stage block h-48 w-full" />
                      <div v-if="technique.technique" class="p-4">
                          <div class="mb-3 flex flex-wrap gap-1">
                              <span v-for="m in technique.technique.muscles" :key="m" class="rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent tracking-label">{{ m }}</span>
                          </div>
                          <ol class="space-y-2">
                              <li v-for="(cue, i) in technique.technique.cues" :key="i" class="flex gap-3 text-sm leading-snug text-slate-200">
                                  <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-[10px] font-bold text-accent">{{ i + 1 }}</span>
                                  <span>{{ cue }}</span>
                              </li>
                          </ol>
                      </div>
                  </div>
                  <p v-else class="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-slate-500">{{ t('info.noTechnique') }}</p>

                  <!-- Eigene Werte -->
                  <h3 class="mb-2 mt-5 text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('info.yourNumbers') }}</h3>
                  <div v-if="record" class="grid grid-cols-2 gap-2">
                      <div class="rounded-xl bg-white/5 p-3">
                          <div class="text-[10px] font-bold uppercase text-slate-500 tracking-label">{{ t('info.last') }}</div>
                          <div class="mt-1 truncate font-mono text-sm font-bold text-white">{{ lastSetLabel(ex) || '-' }}</div>
                      </div>
                      <div class="rounded-xl bg-white/5 p-3">
                          <div class="text-[10px] font-bold uppercase text-slate-500 tracking-label">{{ t('info.sessions') }}</div>
                          <div class="mt-1 font-mono text-sm font-bold text-white">{{ record.sessions }}</div>
                      </div>
                      <template v-if="isWeight">
                          <div class="rounded-xl bg-white/5 p-3">
                              <div class="text-[10px] font-bold uppercase text-slate-500 tracking-label">{{ t('info.best') }}</div>
                              <div class="mt-1 font-mono text-sm font-bold text-white">{{ record.maxWeight ? formatNumber(record.maxWeight.value, 2) + ' ' + t('units.kg') : '-' }}</div>
                          </div>
                          <div class="rounded-xl bg-white/5 p-3">
                              <div class="text-[10px] font-bold uppercase text-slate-500 tracking-label">{{ t('info.e1rm') }}</div>
                              <div class="mt-1 font-mono text-sm font-bold text-white">{{ record.maxE1RM ? formatNumber(record.maxE1RM.value, 1) + ' ' + t('units.kg') : '-' }}</div>
                          </div>
                      </template>
                  </div>
                  <p v-else class="text-sm text-slate-500">{{ t('info.never') }}</p>

                  <!-- Kraft-Ziel -->
                  <template v-if="isWeight">
                      <h3 class="mb-2 mt-5 text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('goals.title') }}</h3>
                      <button v-if="goalView" type="button" @click="goal" class="w-full rounded-2xl border border-accent/30 bg-accent/5 p-4 text-left transition-colors hover:bg-accent/10" data-test="info-goal">
                          <div class="flex items-baseline justify-between gap-2">
                              <span class="display text-lg text-white">{{ goalTargetLabel(goalView.goal) }}</span>
                              <span class="font-mono text-sm font-bold text-accent">{{ goalView.progress.percent }}%</span>
                          </div>
                          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-accent" :style="{ width: goalView.progress.percent + '%' }"></div></div>
                          <div class="mt-2 font-mono text-[11px] text-slate-300">{{ prescriptionLabel(goalView.next, goalView.goal) }}</div>
                          <div class="font-mono text-[11px] text-slate-500">{{ etaLabel(goalView.progress) }}</div>
                      </button>
                      <button v-else type="button" @click="goal" class="btn-secondary w-full rounded-2xl py-3.5 text-sm" data-test="info-set-goal">{{ t('goals.setGoal') }}</button>
                  </template>
              </div>

              <div v-if="fromPicker" class="border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button type="button" @click="pick" :disabled="inWorkout" class="w-full rounded-xl py-4 text-sm" :class="selected ? 'btn-secondary' : 'btn-primary'" data-test="info-pick">
                      {{ inWorkout ? t('picker.inWorkout') : selected ? t('info.selected') : t('info.select') }}
                  </button>
              </div>
          </div>
      </div>
  </transition>
</template>
