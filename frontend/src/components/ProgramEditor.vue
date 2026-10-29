<script setup lang="ts">
import { t } from '@/i18n';
import { categoryName, exerciseName } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { newDraftStep, type DraftExercise } from '@/lib/program';
import { ref } from 'vue';

const app = useAppStore();
const { exerciseGroups, programEditor, programs } = storeToRefs(app);
const { addDay, addExerciseRow, deleteProgram, moveExerciseRow, removeDay, removeExerciseRow, rowType, saveProgram } = app;

/** Aufgeklappte "Steigerung nach Wochen" (Schlüssel: Tag-Übung). */
const openSteps = ref(new Set<string>());
const stepKey = (d: number, i: number) => `${d}-${i}`;
function toggleSteps(d: number, i: number) {
  const key = stepKey(d, i);
  const next = new Set(openSteps.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  openSteps.value = next;
}
const maxWeek = () => Number(programEditor.value.draft.cycleWeeks) || Number(programEditor.value.draft.weeks) || 1;
function addStep(row: DraftExercise, d: number, i: number) {
  row.weekSteps = [...(row.weekSteps ?? []), newDraftStep(row, maxWeek())];
  openSteps.value = new Set(openSteps.value).add(stepKey(d, i));
}
function removeStep(row: DraftExercise, index: number) {
  row.weekSteps = (row.weekSteps ?? []).filter((_, n) => n !== index);
}
const CYCLES = [null, 2, 3, 4, 5, 6] as const;
const DELOADS = [null, 3, 4, 5, 6, 8] as const;
</script>

<template>
  <transition name="fade">
      <div v-if="programEditor.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center" @click.self="programEditor.open = false">
          <form @submit.prevent="saveProgram" class="glass-panel modal-panel max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] p-5 sm:rounded-[2rem] sm:p-7" role="dialog" aria-modal="true" :aria-label="programEditor.draft.id ? `${t('editor.titleEdit')} ${t('editor.titleEditAccent')}` : `${t('editor.titleNew')} ${t('editor.titleAccent')}`">
              <div class="mb-5 flex items-start justify-between">
                  <h3 class="text-2xl font-black text-white">{{ programEditor.draft.id ? t('editor.titleEdit') : t('editor.titleNew') }} <span class="text-accent">{{ programEditor.draft.id ? t('editor.titleEditAccent') : t('editor.titleAccent') }}</span></h3>
                  <button type="button" @click="programEditor.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="mb-5 grid grid-cols-6 gap-3">
                  <label class="col-span-6 sm:col-span-3"><span class="label-xs mb-2">{{ t('editor.name') }}</span>
                      <input v-model="programEditor.draft.name" maxlength="60" class="cyber-input w-full rounded-xl p-3 text-sm" :placeholder="t('editor.namePlaceholder')"></label>
                  <label class="col-span-4 sm:col-span-2"><span class="label-xs mb-2">{{ t('editor.goal') }}</span>
                      <select v-model="programEditor.draft.goal" class="cyber-input w-full rounded-xl p-3 text-sm">
                          <option v-for="g in (['Strength', 'Hypertrophy', 'Speed', 'General'] as const)" :key="g" :value="g">{{ t(`plan.goals.${g}`) }}</option>
                      </select></label>
                  <label class="col-span-2 sm:col-span-1"><span class="label-xs mb-2">{{ t('editor.weeks') }}</span>
                      <input v-model.number="programEditor.draft.weeks" type="number" min="1" max="52" class="cyber-input w-full rounded-xl p-3 text-sm"></label>
                  <label class="col-span-3"><span class="label-xs mb-2">{{ t('editor.deloadEvery') }}</span>
                      <select v-model="programEditor.draft.deloadEvery" class="cyber-input w-full rounded-xl p-3 text-sm" data-test="deload-every">
                          <option v-for="n in DELOADS" :key="String(n)" :value="n">{{ n ? `${n} ${t('editor.weeksSuffix')}` : t('editor.off') }}</option>
                      </select></label>
                  <label class="col-span-3"><span class="label-xs mb-2">{{ t('editor.cycleWeeks') }}</span>
                      <select v-model="programEditor.draft.cycleWeeks" class="cyber-input w-full rounded-xl p-3 text-sm">
                          <option v-for="n in CYCLES" :key="String(n)" :value="n">{{ n ? `${n} ${t('editor.weeksSuffix')}` : t('editor.off') }}</option>
                      </select></label>
              </div>

              <div v-for="(day, d) in programEditor.draft.days" :key="d" class="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div class="mb-3 flex items-center gap-2">
                      <input v-model="day.name" maxlength="40" class="cyber-input flex-1 rounded-lg p-2 text-sm font-bold" :aria-label="t('editor.dayName', { n: d + 1 })">
                      <button type="button" v-if="programEditor.draft.days.length > 1" @click="removeDay(d)" class="danger-btn rounded-lg px-3 py-2 text-[9px] font-bold uppercase tracking-widest">{{ t('editor.removeDay') }}</button>
                  </div>
                  <div v-for="(row, i) in day.exercises" :key="i" class="mb-2 rounded-xl border border-white/5 bg-black/30 p-3">
                      <div class="mb-2 flex items-center gap-2">
                          <select v-model.number="row.exerciseId" class="cyber-input min-w-0 flex-1 rounded-lg p-2 text-xs" :aria-label="t('editor.exercise', { n: i + 1 })">
                              <option value="" disabled>{{ t('editor.chooseExercise') }}</option>
                              <optgroup v-for="g in exerciseGroups" :key="g.label" :label="categoryName(g.category)">
                                  <option v-for="e in g.items" :key="e.id" :value="e.id">{{ exerciseName(e) }}</option>
                              </optgroup>
                          </select>
                          <button type="button" @click="moveExerciseRow(day, i, -1)" class="h-8 w-7 rounded text-slate-500 hover:text-white" :aria-label="t('editor.moveUp')">↑</button>
                          <button type="button" @click="moveExerciseRow(day, i, 1)" class="h-8 w-7 rounded text-slate-500 hover:text-white" :aria-label="t('editor.moveDown')">↓</button>
                          <button type="button" @click="removeExerciseRow(day, i)" class="h-8 w-7 rounded text-red-400/70 hover:text-red-400" :aria-label="t('editor.removeExercise')">✕</button>
                      </div>
                      <div class="grid grid-cols-4 gap-2 font-mono text-[10px] text-slate-500">
                          <label>{{ t('editor.sets') }}<input v-model.number="row.sets" type="number" min="1" max="20" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <template v-if="rowType(row) === 'WeightReps'">
                              <label>{{ t('editor.repsMin') }}<input v-model.number="row.repsMin" type="number" min="1" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                              <label>{{ t('editor.repsMax') }}<input v-model.number="row.repsMax" type="number" min="1" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                              <label>{{ t('editor.step') }}<input v-model.number="row.progressionStep" type="number" min="0" max="20" step="0.25" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          </template>
                          <label v-else-if="rowType(row) === 'DistanceTime'" class="col-span-3">{{ t('editor.distance') }}<input v-model.number="row.distance" type="number" min="1" max="10000" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <label v-else class="col-span-3">{{ t('editor.time') }}<input v-model.number="row.time" type="number" min="1" max="3600" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <label class="col-span-2">{{ t('editor.rest') }}<input v-model.number="row.restSeconds" type="number" min="0" max="900" step="15" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <label :class="rowType(row) === 'WeightReps' ? 'col-span-1' : 'col-span-2'">{{ t('editor.targetRpe') }}<input v-model.number="row.targetRpe" type="number" min="5" max="10" step="0.5" class="cyber-input mt-1 w-full rounded p-1.5 text-xs" :placeholder="t('common.optional')"></label>
                          <label v-if="rowType(row) === 'WeightReps'" class="col-span-1">{{ t('editor.percent') }}<input v-model.number="row.percentOf1Rm" type="number" min="30" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs" :placeholder="t('common.optional')"></label>
                          <label class="col-span-4">{{ t('editor.note') }}<input v-model="row.note" maxlength="120" class="cyber-input mt-1 w-full rounded p-1.5 text-xs" :placeholder="t('editor.notePlaceholder')"></label>
                      </div>

                      <!-- Steigerung nach Wochen -->
                      <div class="mt-2">
                          <div class="flex items-center justify-between">
                              <button type="button" @click="toggleSteps(d, i)" class="font-mono text-[10px] text-slate-400 hover:text-accent">
                                  {{ openSteps.has(stepKey(d, i)) ? '▾' : '▸' }} {{ t('editor.weekSteps') }}<template v-if="row.weekSteps?.length"> ({{ row.weekSteps.length }})</template>
                              </button>
                              <button type="button" @click="addStep(row, d, i)" class="font-mono text-[10px] font-bold text-accent/80 hover:text-accent">{{ t('editor.addStep') }}</button>
                          </div>
                          <div v-if="openSteps.has(stepKey(d, i)) && row.weekSteps?.length" class="mt-2 space-y-2">
                              <p class="font-mono text-[9px] text-slate-500">{{ t('editor.stepsHint') }}</p>
                              <div v-for="(st, n) in row.weekSteps" :key="n" class="grid grid-cols-6 items-end gap-2 rounded-lg border border-white/5 bg-black/30 p-2 font-mono text-[10px] text-slate-500">
                                  <label>{{ t('editor.fromWeek') }}<input v-model.number="st.fromWeek" type="number" min="1" :max="maxWeek()" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                  <label>{{ t('editor.sets') }}<input v-model.number="st.sets" type="number" min="1" max="20" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                  <template v-if="rowType(row) === 'WeightReps'">
                                      <label>{{ t('editor.repsMin') }}<input v-model.number="st.repsMin" type="number" min="1" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                      <label>{{ t('editor.repsMax') }}<input v-model.number="st.repsMax" type="number" min="1" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                      <label>%<input v-model.number="st.percentOf1Rm" type="number" min="30" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                  </template>
                                  <label v-else-if="rowType(row) === 'DistanceTime'" class="col-span-3">{{ t('editor.distance') }}<input v-model.number="st.distance" type="number" min="1" max="10000" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                  <label v-else class="col-span-3">{{ t('editor.time') }}<input v-model.number="st.time" type="number" min="1" max="3600" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                                  <button type="button" @click="removeStep(row, n)" class="h-8 rounded text-red-400/70 hover:text-red-400" :aria-label="t('editor.removeStep')">✕</button>
                                  <label class="col-span-6">{{ t('editor.note') }}<input v-model="st.note" maxlength="80" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                              </div>
                          </div>
                      </div>
                  </div>
                  <button type="button" @click="addExerciseRow(day)" class="mt-1 w-full rounded-lg border border-dashed border-white/15 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-accent/50 hover:text-accent">{{ t('editor.addExercise') }}</button>
              </div>
              <button type="button" v-if="programEditor.draft.days.length < 7" @click="addDay" class="mb-5 w-full rounded-xl border border-dashed border-white/15 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:border-accent/50 hover:text-accent">{{ t('editor.addDay') }}</button>

              <p v-if="programEditor.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ programEditor.error }}</p>
              <div class="flex gap-3">
                  <button type="button" v-if="programEditor.draft.id" @click="deleteProgram(programs.find(p => p.id === programEditor.draft.id))" class="danger-btn rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest">{{ t('common.delete') }}</button>
                  <button type="submit" :disabled="programEditor.busy" class="cyber-btn flex-1 rounded-xl py-3 font-bold">{{ programEditor.busy ? t('common.saving') : t('editor.saveProgram') }}</button>
              </div>
          </form>
      </div>
  </transition>
</template>
