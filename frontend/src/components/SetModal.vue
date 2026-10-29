<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, SET_RPE, trackingLabel } from '@/stores/app';
import { describeSet, formatClock, formatNumber, formatRelative, formatSeconds } from '@/lib/format';
import { msToKmh } from '@/lib/analytics';
import { prescriptionText } from '@/lib/program';
import ExerciseFigure from '@/components/ExerciseFigure.vue';

const app = useAppStore();
const { clockDate, isEditing, modalE1RM, modalEx, modalIntensity, modalIsNewPR, modalPrevious, modalRecord, modalSessionSets, modalSpeed, modalSpeedVsBest, modalTarget, modalTechnique, modalType, modalZone, setModal, settings } = storeToRefs(app);
const { closeSetModal, copyPrevious, deleteCustomExercise, saveSet, setWeightByPercentage, step } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="setModal.open && modalEx" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center" @click.self="closeSetModal">
          <div class="glass-panel modal-panel relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8" role="dialog" aria-modal="true" :aria-label="modalEx.name">
              <div class="mb-6 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                      <h3 class="text-2xl font-black text-white">{{ modalEx.name }}</h3>
                      <p class="mt-1 text-xs font-bold uppercase tracking-widest text-accent">{{ modalEx.muscleGroup || 'Other' }} · {{ trackingLabel(modalType) }}</p>
                  </div>
                  <button @click="closeSetModal" class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" aria-label="Close">✕</button>
              </div>

              <div v-if="modalTarget && setModal.editIndex === null" class="mb-5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                  <div class="flex items-center justify-between">
                      <span class="text-[9px] font-bold uppercase tracking-widest text-accent">Plan · {{ prescriptionText(modalTarget) }}</span>
                      <span class="font-mono text-[10px] text-slate-400">{{ modalSessionSets.filter(s => !s.isWarmup).length }}/{{ modalTarget.sets }}</span>
                  </div>
                  <div class="mt-1 font-mono text-[10px]" :class="modalTarget.suggestion.kind === 'progress' ? 'text-yellow-400' : 'text-slate-400'">{{ modalTarget.suggestion.note }}</div>
              </div>

              <!-- Technik: animierte Figur + Hinweise -->
              <div v-if="modalTechnique.motion || modalTechnique.technique" class="mb-5 overflow-hidden rounded-2xl border border-white/5 bg-black/30">
                  <button @click="settings.showTechnique = !settings.showTechnique" class="flex w-full items-center justify-between px-4 py-2.5 text-left" :aria-expanded="settings.showTechnique">
                      <span class="label-xs">Technique</span>
                      <span class="font-mono text-[10px] text-slate-500">{{ settings.showTechnique ? 'Hide' : 'Show' }}</span>
                  </button>
                  <div v-if="settings.showTechnique" class="flex gap-3 border-t border-white/5 p-3">
                      <ExerciseFigure v-if="modalTechnique.motion" :motion="modalTechnique.motion" class="block h-44 w-[46%] max-w-[220px] flex-shrink-0 rounded-xl bg-[#060a12]" />
                      <div v-if="modalTechnique.technique" class="min-w-0 flex-1">
                          <div class="mb-2 flex flex-wrap gap-1">
                              <span v-for="m in modalTechnique.technique.muscles" :key="m" class="rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">{{ m }}</span>
                          </div>
                          <ol class="space-y-1.5">
                              <li v-for="(cue, i) in modalTechnique.technique.cues" :key="i" class="flex gap-2 text-xs leading-snug text-slate-300">
                                  <span class="font-mono text-[10px] font-bold text-accent">{{ i + 1 }}</span><span>{{ cue }}</span>
                              </li>
                          </ol>
                      </div>
                  </div>
              </div>

              <div v-if="modalPrevious && setModal.editIndex === null" @click="copyPrevious" role="button" tabindex="0"
                   class="group mb-5 flex cursor-pointer items-center justify-between rounded-xl border border-accent/20 bg-accent/5 p-4 transition-all hover:border-accent/50 hover:bg-accent/15">
                  <div>
                      <div class="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Previous · {{ formatRelative(modalPrevious.date, clockDate) }}</div>
                      <div class="font-mono text-sm font-bold text-white group-hover:text-accent">{{ describeSet(modalPrevious, modalType) }}</div>
                  </div>
                  <span class="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-accent group-hover:bg-accent group-hover:text-black">Copy</span>
              </div>

              <div v-if="modalSessionSets.length && setModal.editIndex === null" class="mb-5 flex flex-wrap gap-1.5">
                  <span class="mr-1 self-center text-[9px] font-bold uppercase tracking-widest text-slate-500">Today</span>
                  <span v-for="(s, i) in modalSessionSets" :key="i" class="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-300">{{ describeSet(s, modalType) }}</span>
              </div>

              <!-- Gewicht × Wiederholungen -->
              <template v-if="modalType === 'WeightReps'">
                  <div class="mb-6 rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div class="mb-3 flex items-center justify-between">
                          <span class="label-xs">Live telemetry</span>
                          <span class="rounded border border-white/5 bg-black/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest" :class="modalZone.color">{{ modalZone.name }}</span>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">Est. 1RM</div>
                              <div class="font-mono text-xl font-black text-white">{{ modalE1RM > 0 ? formatNumber(modalE1RM) : '--' }}<span v-if="modalE1RM > 0" class="ml-1 text-xs text-slate-500">kg</span></div>
                          </div>
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">Intensity / PR</div>
                              <div class="font-mono text-xl font-black" :class="modalIntensity > 100 ? 'text-yellow-400' : 'text-accent'">{{ modalIntensity > 0 ? modalIntensity : '--' }}<span v-if="modalIntensity > 0" class="ml-1 text-xs">%</span></div>
                          </div>
                      </div>
                      <div v-if="modalRecord?.maxWeight" class="mt-4 flex justify-between gap-2 border-t border-white/5 pt-3">
                          <button v-for="p in [70, 80, 90]" :key="p" @click="setWeightByPercentage(p)" class="preset-btn">{{ p }}%</button>
                          <button @click="setWeightByPercentage(100)" class="preset-btn !bg-yellow-400/10 !text-yellow-400">PR {{ formatNumber(modalRecord.maxWeight.value, 2) }}</button>
                      </div>
                  </div>

                  <div class="mb-5">
                      <label class="label-xs mb-3" for="in-weight">Weight (kg) · 0 = bodyweight</label>
                      <div class="stepper">
                          <button @click="step('weight', -2.5)" class="stepper-btn" aria-label="Decrease weight">-</button>
                          <input id="in-weight" v-model.number="setModal.weight" type="number" inputmode="decimal" min="0" step="0.5" class="stepper-input">
                          <button @click="step('weight', 2.5)" class="stepper-btn" aria-label="Increase weight">+</button>
                      </div>
                  </div>
                  <div class="mb-6">
                      <label class="label-xs mb-3" for="in-reps">Reps</label>
                      <div class="stepper">
                          <button @click="step('reps', -1, 1, 0)" class="stepper-btn" aria-label="Decrease reps">-</button>
                          <input id="in-reps" v-model.number="setModal.reps" type="number" inputmode="numeric" min="1" step="1" class="stepper-input">
                          <button @click="step('reps', 1, 1, 0)" class="stepper-btn" aria-label="Increase reps">+</button>
                      </div>
                  </div>
              </template>

              <!-- Distanz + Zeit -->
              <template v-else-if="modalType === 'DistanceTime'">
                  <div class="mb-6 rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div class="mb-3 flex items-center justify-between">
                          <span class="label-xs">Live telemetry</span>
                          <span v-if="modalRecord?.topSpeed" class="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">Top {{ formatNumber(msToKmh(modalRecord.topSpeed.value)) }} km/h</span>
                      </div>
                      <div class="grid grid-cols-3 gap-3">
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">Speed</div>
                              <div class="font-mono text-xl font-black text-white">{{ modalSpeed > 0 ? formatNumber(msToKmh(modalSpeed)) : '--' }}<span class="ml-1 text-[10px] text-slate-500">km/h</span></div>
                          </div>
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">Pace</div>
                              <div class="font-mono text-xl font-black text-white">{{ modalSpeed > 0 ? formatNumber(modalSpeed, 2) : '--' }}<span class="ml-1 text-[10px] text-slate-500">m/s</span></div>
                          </div>
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">vs Best</div>
                              <div class="font-mono text-xl font-black" :class="modalSpeedVsBest > 100 ? 'text-yellow-400' : 'text-emerald-400'">{{ modalSpeedVsBest > 0 ? modalSpeedVsBest + '%' : '--' }}</div>
                          </div>
                      </div>
                  </div>

                  <div class="mb-5">
                      <label class="label-xs mb-3" for="in-distance">Distance (m)</label>
                      <div class="mb-2 flex gap-2">
                          <button v-for="d in [10, 20, 30, 40, 60, 100]" :key="d" @click="setModal.distance = d" class="preset-btn" :class="{ '!border-accent/50 !text-accent': setModal.distance === d }">{{ d }}</button>
                      </div>
                      <div class="stepper">
                          <button @click="step('distance', -5)" class="stepper-btn" aria-label="Decrease distance">-</button>
                          <input id="in-distance" v-model.number="setModal.distance" type="number" inputmode="decimal" min="0" step="1" class="stepper-input">
                          <button @click="step('distance', 5)" class="stepper-btn" aria-label="Increase distance">+</button>
                      </div>
                  </div>
                  <div class="mb-6">
                      <label class="label-xs mb-3" for="in-time">Time (s)</label>
                      <div class="stepper">
                          <button @click="step('time', -0.1)" class="stepper-btn" aria-label="Decrease time">-</button>
                          <input id="in-time" v-model.number="setModal.time" type="number" inputmode="decimal" min="0" step="0.01" class="stepper-input">
                          <button @click="step('time', 0.1)" class="stepper-btn" aria-label="Increase time">+</button>
                      </div>
                  </div>
              </template>

              <!-- Dauer -->
              <template v-else>
                  <div class="mb-6">
                      <label class="label-xs mb-3" for="in-duration">Duration (s) · {{ formatClock(setModal.time || 0) }}</label>
                      <div class="mb-2 flex gap-2">
                          <button v-for="d in [30, 45, 60, 90, 120]" :key="d" @click="setModal.time = d" class="preset-btn" :class="{ '!border-accent/50 !text-accent': setModal.time === d }">{{ d }}s</button>
                      </div>
                      <div class="stepper">
                          <button @click="step('time', -5, 0, 0)" class="stepper-btn" aria-label="Decrease duration">-</button>
                          <input id="in-duration" v-model.number="setModal.time" type="number" inputmode="numeric" min="0" step="1" class="stepper-input">
                          <button @click="step('time', 5, 0, 0)" class="stepper-btn" aria-label="Increase duration">+</button>
                      </div>
                      <p v-if="modalRecord?.longest" class="mt-2 font-mono text-[10px] text-slate-500">Longest: {{ formatSeconds(modalRecord.longest.value) }}</p>
                  </div>
              </template>

              <!-- RPE + Aufwärmsatz -->
              <div class="mb-6">
                  <div class="mb-2 flex items-center justify-between">
                      <span class="label-xs">RPE <span class="normal-case tracking-normal text-slate-500">· 10 = max, 8 = 2 reps left</span></span>
                      <label class="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-widest" :class="setModal.isWarmup ? 'text-orange-300' : 'text-slate-500'">
                          <input v-model="setModal.isWarmup" type="checkbox" class="h-4 w-4 accent-[#fb923c]"> Warm-up
                      </label>
                  </div>
                  <div class="flex gap-1.5">
                      <button @click="setModal.rpe = null" class="preset-btn" :class="{ '!border-accent/50 !text-accent': setModal.rpe === null }">-</button>
                      <button v-for="r in SET_RPE" :key="r" @click="setModal.rpe = r" class="preset-btn" :class="{ '!border-orange-400/60 !text-orange-300': setModal.rpe === r }">{{ r }}</button>
                  </div>
              </div>

              <p v-if="modalIsNewPR" class="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-yellow-400">👑 This would be a new record</p>

              <button @click="saveSet" class="cyber-btn w-full rounded-xl py-4 text-lg font-bold">{{ setModal.editIndex !== null ? 'Update set' : 'Log set' }}</button>
              <p v-if="settings.autoTimer && setModal.editIndex === null && !isEditing" class="mt-3 text-center font-mono text-[10px] text-slate-500">Rest timer starts automatically ({{ modalEx.category === 'Football' ? settings.restField : settings.restGym }}s)</p>

              <div v-if="modalEx.isCustom" class="mt-6 border-t border-white/5 pt-4 text-center">
                  <button @click="deleteCustomExercise(modalEx)" class="text-[10px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400">Delete custom exercise</button>
              </div>
          </div>
      </div>
  </transition>
</template>
