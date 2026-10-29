<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { exerciseGroups, programEditor, programs } = storeToRefs(app);
const { addDay, addExerciseRow, deleteProgram, moveExerciseRow, removeDay, removeExerciseRow, rowType, saveProgram } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="programEditor.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center" @click.self="programEditor.open = false">
          <form @submit.prevent="saveProgram" class="glass-panel modal-panel max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] p-5 sm:rounded-[2rem] sm:p-7" role="dialog" aria-modal="true" aria-label="Program editor">
              <div class="mb-5 flex items-start justify-between">
                  <h3 class="text-2xl font-black text-white">{{ programEditor.draft.id ? 'Edit' : 'New' }} <span class="text-accent">program</span></h3>
                  <button type="button" @click="programEditor.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" aria-label="Close">✕</button>
              </div>

              <div class="mb-5 grid grid-cols-6 gap-3">
                  <label class="col-span-6 sm:col-span-3"><span class="label-xs mb-2">Name</span>
                      <input v-model="programEditor.draft.name" maxlength="60" class="cyber-input w-full rounded-xl p-3 text-sm" placeholder="e.g. Pre-season strength"></label>
                  <label class="col-span-4 sm:col-span-2"><span class="label-xs mb-2">Goal</span>
                      <select v-model="programEditor.draft.goal" class="cyber-input w-full rounded-xl p-3 text-sm">
                          <option v-for="g in ['Strength','Hypertrophy','Speed','General']" :key="g" :value="g">{{ g }}</option>
                      </select></label>
                  <label class="col-span-2 sm:col-span-1"><span class="label-xs mb-2">Weeks</span>
                      <input v-model.number="programEditor.draft.weeks" type="number" min="1" max="52" class="cyber-input w-full rounded-xl p-3 text-sm"></label>
              </div>

              <div v-for="(day, d) in programEditor.draft.days" :key="d" class="mb-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div class="mb-3 flex items-center gap-2">
                      <input v-model="day.name" maxlength="40" class="cyber-input flex-1 rounded-lg p-2 text-sm font-bold" :aria-label="'Day ' + (d + 1) + ' name'">
                      <button type="button" v-if="programEditor.draft.days.length > 1" @click="removeDay(d)" class="danger-btn rounded-lg px-3 py-2 text-[9px] font-bold uppercase tracking-widest">Remove day</button>
                  </div>
                  <div v-for="(row, i) in day.exercises" :key="i" class="mb-2 rounded-xl border border-white/5 bg-black/30 p-3">
                      <div class="mb-2 flex items-center gap-2">
                          <select v-model.number="row.exerciseId" class="cyber-input min-w-0 flex-1 rounded-lg p-2 text-xs" :aria-label="'Exercise ' + (i + 1)">
                              <option value="" disabled>Choose exercise...</option>
                              <optgroup v-for="g in exerciseGroups" :key="g.label" :label="g.label">
                                  <option v-for="e in g.items" :key="e.id" :value="e.id">{{ e.name }}</option>
                              </optgroup>
                          </select>
                          <button type="button" @click="moveExerciseRow(day, i, -1)" class="h-8 w-7 rounded text-slate-500 hover:text-white" aria-label="Move up">↑</button>
                          <button type="button" @click="moveExerciseRow(day, i, 1)" class="h-8 w-7 rounded text-slate-500 hover:text-white" aria-label="Move down">↓</button>
                          <button type="button" @click="removeExerciseRow(day, i)" class="h-8 w-7 rounded text-red-400/70 hover:text-red-400" aria-label="Remove exercise">✕</button>
                      </div>
                      <div class="grid grid-cols-4 gap-2 font-mono text-[10px] text-slate-500">
                          <label>Sets<input v-model.number="row.sets" type="number" min="1" max="20" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <template v-if="rowType(row) === 'WeightReps'">
                              <label>Reps min<input v-model.number="row.repsMin" type="number" min="1" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                              <label>Reps max<input v-model.number="row.repsMax" type="number" min="1" max="100" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                              <label>+kg step<input v-model.number="row.progressionStep" type="number" min="0" max="20" step="0.25" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          </template>
                          <label v-else-if="rowType(row) === 'DistanceTime'" class="col-span-3">Distance (m)<input v-model.number="row.distance" type="number" min="1" max="10000" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <label v-else class="col-span-3">Time (s)<input v-model.number="row.time" type="number" min="1" max="3600" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <label class="col-span-2">Rest (s)<input v-model.number="row.restSeconds" type="number" min="0" max="900" step="15" class="cyber-input mt-1 w-full rounded p-1.5 text-xs"></label>
                          <label class="col-span-2">Target RPE<input v-model.number="row.targetRpe" type="number" min="5" max="10" step="0.5" class="cyber-input mt-1 w-full rounded p-1.5 text-xs" placeholder="optional"></label>
                      </div>
                  </div>
                  <button type="button" @click="addExerciseRow(day)" class="mt-1 w-full rounded-lg border border-dashed border-white/15 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-accent/50 hover:text-accent">+ Add exercise</button>
              </div>
              <button type="button" v-if="programEditor.draft.days.length < 7" @click="addDay" class="mb-5 w-full rounded-xl border border-dashed border-white/15 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:border-accent/50 hover:text-accent">+ Add day</button>

              <p v-if="programEditor.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ programEditor.error }}</p>
              <div class="flex gap-3">
                  <button type="button" v-if="programEditor.draft.id" @click="deleteProgram(programs.find(p => p.id === programEditor.draft.id))" class="danger-btn rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest">Delete</button>
                  <button type="submit" :disabled="programEditor.busy" class="cyber-btn flex-1 rounded-xl py-3 font-bold">{{ programEditor.busy ? 'Saving...' : 'Save program' }}</button>
              </div>
          </form>
      </div>
  </transition>
</template>
