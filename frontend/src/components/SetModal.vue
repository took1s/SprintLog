<script setup lang="ts">
import { t, tDynamic } from '@/i18n';
import { exerciseName, muscleName } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore, SET_RPE, rpeToRir } from '@/stores/app';
import { describeSet, formatClock, formatNumber, formatRelative, formatSeconds } from '@/lib/format';
import { msToKmh } from '@/lib/analytics';
import { prescriptionText, suggestionNote } from '@/lib/program';
import ExerciseFigure from '@/components/ExerciseFigure.vue';

const app = useAppStore();
const { clockDate, isEditing, modalE1RM, modalEx, modalIntensity, modalIsNewPR, modalPrevious, modalRecord, modalSessionSets, modalSpeed, modalSpeedVsBest, modalTarget, modalTechnique, modalType, modalZone, setModal, settings } = storeToRefs(app);
const { closeSetModal, copyPrevious, deleteCustomExercise, saveSet, setWeightByPercentage, step } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="setModal.open && modalEx" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center" @click.self="closeSetModal">
          <div class="glass-panel modal-panel relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8" role="dialog" aria-modal="true" :aria-label="exerciseName(modalEx)">
              <div class="mb-6 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                      <h3 class="text-2xl display text-white">{{ exerciseName(modalEx) }}</h3>
                      <p class="mt-1 text-xs font-bold uppercase tracking-widest text-accent">{{ muscleName(modalEx.muscleGroup) }} · {{ t(`tracking.${modalType}`) }}</p>
                  </div>
                  <button @click="closeSetModal" class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div v-if="modalTarget && setModal.editIndex === null" class="mb-5 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                  <div class="flex items-center justify-between">
                      <span class="text-[9px] font-bold uppercase tracking-widest text-accent">{{ t('set.plan', { text: prescriptionText(modalTarget) }) }}</span>
                      <span class="font-mono text-[10px] text-slate-400">{{ modalSessionSets.filter(s => !s.isWarmup).length }}/{{ modalTarget.sets }}</span>
                  </div>
                  <div class="mt-1 font-mono text-[10px]" :class="modalTarget.suggestion.kind === 'progress' ? 'text-yellow-400' : 'text-slate-400'">{{ suggestionNote(modalTarget.suggestion) }}</div>
              </div>

              <!-- Technik: animierte Figur + Hinweise -->
              <div v-if="modalTechnique.motion || modalTechnique.technique" class="mb-5 overflow-hidden rounded-2xl border border-white/5 bg-black/30">
                  <button @click="settings.showTechnique = !settings.showTechnique" class="flex w-full items-center justify-between px-4 py-2.5 text-left" :aria-expanded="settings.showTechnique">
                      <span class="label-xs">{{ t('set.technique') }}</span>
                      <span class="font-mono text-[10px] text-slate-500">{{ settings.showTechnique ? t('common.hide') : t('common.show') }}</span>
                  </button>
                  <div v-if="settings.showTechnique" class="flex gap-3 border-t border-white/5 p-3">
                      <ExerciseFigure v-if="modalTechnique.motion" :motion="modalTechnique.motion" class="block h-44 w-[46%] max-w-[220px] flex-shrink-0 rounded-xl fx-stage" />
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
                      <div class="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{{ t('set.previous', { when: formatRelative(modalPrevious.date, clockDate) }) }}</div>
                      <div class="font-mono text-sm font-bold text-white group-hover:text-accent">{{ describeSet(modalPrevious, modalType) }}</div>
                  </div>
                  <span class="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-accent group-hover:bg-accent group-hover:text-black">{{ t('common.copy') }}</span>
              </div>

              <div v-if="modalSessionSets.length && setModal.editIndex === null" class="mb-5 flex flex-wrap gap-1.5">
                  <span class="mr-1 self-center text-[9px] font-bold uppercase tracking-widest text-slate-500">{{ t('set.today') }}</span>
                  <span v-for="(s, i) in modalSessionSets" :key="i" class="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-300">{{ describeSet(s, modalType) }}</span>
              </div>

              <!-- Gewicht × Wiederholungen -->
              <template v-if="modalType === 'WeightReps'">
                  <div class="mb-6 rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div class="mb-3 flex items-center justify-between">
                          <span class="label-xs">{{ t('set.telemetry') }}</span>
                          <span class="rounded border border-white/5 bg-black/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest" :class="modalZone.color">{{ tDynamic(`set.zones.${modalZone.key}`, modalZone.key) }}</span>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">{{ t('set.e1rm') }}</div>
                              <div class="font-mono text-xl font-black text-white">{{ modalE1RM > 0 ? formatNumber(modalE1RM) : '--' }}<span v-if="modalE1RM > 0" class="ml-1 text-xs text-slate-500">{{ t('units.kg') }}</span></div>
                          </div>
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">{{ t('set.intensity') }}</div>
                              <div class="font-mono text-xl font-black" :class="modalIntensity > 100 ? 'text-yellow-400' : 'text-accent'">{{ modalIntensity > 0 ? modalIntensity : '--' }}<span v-if="modalIntensity > 0" class="ml-1 text-xs">%</span></div>
                          </div>
                      </div>
                      <div v-if="modalRecord?.maxWeight" class="mt-4 flex justify-between gap-2 border-t border-white/5 pt-3">
                          <button v-for="p in [70, 80, 90]" :key="p" @click="setWeightByPercentage(p)" class="preset-btn">{{ p }}%</button>
                          <button @click="setWeightByPercentage(100)" class="preset-btn !bg-yellow-400/10 !text-yellow-400">PR {{ formatNumber(modalRecord.maxWeight.value, 2) }}</button>
                      </div>
                  </div>

                  <div class="mb-5">
                      <label class="label-xs mb-3" for="in-weight">{{ t('set.weight') }}</label>
                      <div class="stepper">
                          <button @click="step('weight', -2.5)" class="stepper-btn" :aria-label="t('set.decrease', { what: t('set.fields.weight') })">-</button>
                          <input id="in-weight" v-model.number="setModal.weight" type="number" inputmode="decimal" min="0" step="0.5" class="stepper-input">
                          <button @click="step('weight', 2.5)" class="stepper-btn" :aria-label="t('set.increase', { what: t('set.fields.weight') })">+</button>
                      </div>
                  </div>
                  <div class="mb-6">
                      <label class="label-xs mb-3" for="in-reps">{{ t('set.reps') }}</label>
                      <div class="stepper">
                          <button @click="step('reps', -1, 1, 0)" class="stepper-btn" :aria-label="t('set.decrease', { what: t('set.fields.reps') })">-</button>
                          <input id="in-reps" v-model.number="setModal.reps" type="number" inputmode="numeric" min="1" step="1" class="stepper-input">
                          <button @click="step('reps', 1, 1, 0)" class="stepper-btn" :aria-label="t('set.increase', { what: t('set.fields.reps') })">+</button>
                      </div>
                  </div>
              </template>

              <!-- Distanz + Zeit -->
              <template v-else-if="modalType === 'DistanceTime'">
                  <div class="mb-6 rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div class="mb-3 flex items-center justify-between">
                          <span class="label-xs">{{ t('set.telemetry') }}</span>
                          <span v-if="modalRecord?.topSpeed" class="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-400">{{ t('set.top', { speed: formatNumber(msToKmh(modalRecord.topSpeed.value)) }) }}</span>
                      </div>
                      <div class="grid grid-cols-3 gap-3">
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">{{ t('set.speed') }}</div>
                              <div class="font-mono text-xl font-black text-white">{{ modalSpeed > 0 ? formatNumber(msToKmh(modalSpeed)) : '--' }}<span class="ml-1 text-[10px] text-slate-500">{{ t('units.kmh') }}</span></div>
                          </div>
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">{{ t('set.pace') }}</div>
                              <div class="font-mono text-xl font-black text-white">{{ modalSpeed > 0 ? formatNumber(modalSpeed, 2) : '--' }}<span class="ml-1 text-[10px] text-slate-500">{{ t('units.ms') }}</span></div>
                          </div>
                          <div>
                              <div class="mb-1 font-mono text-xs text-slate-500">{{ t('set.vsBest') }}</div>
                              <div class="font-mono text-xl font-black" :class="modalSpeedVsBest > 100 ? 'text-yellow-400' : 'text-emerald-400'">{{ modalSpeedVsBest > 0 ? modalSpeedVsBest + '%' : '--' }}</div>
                          </div>
                      </div>
                  </div>

                  <div class="mb-5">
                      <label class="label-xs mb-3" for="in-distance">{{ t('set.distance') }}</label>
                      <div class="mb-2 flex gap-2">
                          <button v-for="d in [10, 20, 30, 40, 60, 100]" :key="d" @click="setModal.distance = d" class="preset-btn" :class="{ '!border-accent/50 !text-accent': setModal.distance === d }">{{ d }}</button>
                      </div>
                      <div class="stepper">
                          <button @click="step('distance', -5)" class="stepper-btn" :aria-label="t('set.decrease', { what: t('set.fields.distance') })">-</button>
                          <input id="in-distance" v-model.number="setModal.distance" type="number" inputmode="decimal" min="0" step="1" class="stepper-input">
                          <button @click="step('distance', 5)" class="stepper-btn" :aria-label="t('set.increase', { what: t('set.fields.distance') })">+</button>
                      </div>
                  </div>
                  <div class="mb-6">
                      <label class="label-xs mb-3" for="in-time">{{ t('set.time') }}</label>
                      <div class="stepper">
                          <button @click="step('time', -0.1)" class="stepper-btn" :aria-label="t('set.decrease', { what: t('set.fields.time') })">-</button>
                          <input id="in-time" v-model.number="setModal.time" type="number" inputmode="decimal" min="0" step="0.01" class="stepper-input">
                          <button @click="step('time', 0.1)" class="stepper-btn" :aria-label="t('set.increase', { what: t('set.fields.time') })">+</button>
                      </div>
                  </div>
              </template>

              <!-- Dauer -->
              <template v-else>
                  <div class="mb-6">
                      <label class="label-xs mb-3" for="in-duration">{{ t('set.duration', { time: formatClock(setModal.time || 0) }) }}</label>
                      <div class="mb-2 flex gap-2">
                          <button v-for="d in [30, 45, 60, 90, 120]" :key="d" @click="setModal.time = d" class="preset-btn" :class="{ '!border-accent/50 !text-accent': setModal.time === d }">{{ d }}s</button>
                      </div>
                      <div class="stepper">
                          <button @click="step('time', -5, 0, 0)" class="stepper-btn" :aria-label="t('set.decrease', { what: t('set.fields.duration') })">-</button>
                          <input id="in-duration" v-model.number="setModal.time" type="number" inputmode="numeric" min="0" step="1" class="stepper-input">
                          <button @click="step('time', 5, 0, 0)" class="stepper-btn" :aria-label="t('set.increase', { what: t('set.fields.duration') })">+</button>
                      </div>
                      <p v-if="modalRecord?.longest" class="mt-2 font-mono text-[10px] text-slate-500">{{ t('set.longest', { time: formatSeconds(modalRecord.longest.value) }) }}</p>
                  </div>
              </template>

              <!-- RPE + Aufwärmsatz -->
              <div class="mb-6">
                  <div class="mb-2 flex items-center justify-between">
                      <span class="label-xs">{{ settings.useRir ? t('set.rir') : t('set.rpe') }} <span class="normal-case tracking-normal text-slate-500">{{ settings.useRir ? t('set.rirHint') : t('set.rpeHint') }}</span></span>
                      <label class="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-widest" :class="setModal.isWarmup ? 'text-orange-300' : 'text-slate-500'">
                          <input v-model="setModal.isWarmup" type="checkbox" class="h-4 w-4"> {{ t('set.warmup') }}
                      </label>
                  </div>
                  <div class="flex gap-1.5">
                      <button @click="setModal.rpe = null" class="preset-btn" :class="{ '!border-accent/50 !text-accent': setModal.rpe === null }">-</button>
                      <button v-for="r in SET_RPE" :key="r" @click="setModal.rpe = r" class="preset-btn" :class="{ '!border-orange-400/60 !text-orange-300': setModal.rpe === r }" :data-rpe="r">{{ settings.useRir ? rpeToRir(r) : r }}</button>
                  </div>
              </div>

              <!-- Notiz zum Satz -->
              <div class="mb-6">
                  <button v-if="!setModal.showNote" type="button" @click="setModal.showNote = true" class="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-accent">{{ t('set.addNote') }}</button>
                  <template v-else>
                      <label for="in-set-note" class="label-xs mb-2 block">{{ t('set.note') }}</label>
                      <input id="in-set-note" v-model="setModal.note" maxlength="200" class="cyber-input w-full rounded-xl p-3 text-sm" :placeholder="t('set.notePlaceholder')">
                  </template>
              </div>

              <p v-if="modalIsNewPR" class="mb-3 text-center text-[10px] font-black uppercase tracking-widest text-yellow-400">{{ t('set.newRecord') }}</p>

              <button @click="saveSet" class="cyber-btn w-full rounded-xl py-4 text-lg font-bold">{{ setModal.editIndex !== null ? t('set.update') : t('set.log') }}</button>
              <p v-if="settings.autoTimer && setModal.editIndex === null && !isEditing" class="mt-3 text-center font-mono text-[10px] text-slate-500">{{ t('set.autoTimer', { seconds: modalTarget?.restSeconds || (modalEx.category === 'Football' ? settings.restField : settings.restGym) }) }}</p>

              <div v-if="modalEx.isCustom" class="mt-6 border-t border-white/5 pt-4 text-center">
                  <button @click="deleteCustomExercise(modalEx)" class="text-[10px] font-bold uppercase tracking-widest text-red-400/80 hover:text-red-400">{{ t('set.deleteCustom') }}</button>
              </div>
          </div>
      </div>
  </transition>
</template>
