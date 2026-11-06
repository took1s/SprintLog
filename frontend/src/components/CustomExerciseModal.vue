<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { vSheetDrag } from '@/lib/gestures';

const app = useAppStore();
const { allMuscleGroups, customModal } = storeToRefs(app);
const { saveCustomExercise } = app;
</script>

<template>
  <transition name="sheet">
      <div v-if="customModal.open" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/80 sm:items-center" @click.self="customModal.open = false">
          <form v-sheet-drag:handle="() => (customModal.open = false)" @submit.prevent="saveCustomExercise" class="glass-panel modal-panel w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl sm:p-8" role="dialog" aria-modal="true" :aria-label="t('catalog.customExercise')">
              <div class="mb-6 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl display text-white">{{ t('custom.title') }} <span class="text-accent">{{ t('custom.titleAccent') }}</span></h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">{{ t('custom.onlyYou') }}</p>
                  </div>
                  <button type="button" @click="customModal.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <label class="label-xs mb-2" for="cx-name">{{ t('custom.name') }}</label>
              <input id="cx-name" v-model="customModal.name" maxlength="60" class="cyber-input mb-4 w-full rounded-xl p-3.5 text-sm" :placeholder="t('custom.namePlaceholder')">

              <label class="label-xs mb-2">{{ t('custom.category') }}</label>
              <div class="mb-4 grid grid-cols-2 gap-2">
                  <button type="button" v-for="c in (['Gym', 'Football'] as const)" :key="c" @click="customModal.category = c" class="chip" :class="customModal.category === c ? 'chip-active' : 'chip-idle'">{{ t(`categories.${c}`) }}</button>
              </div>

              <label class="label-xs mb-2" for="cx-muscle">{{ t('custom.muscleGroup') }}</label>
              <input id="cx-muscle" v-model="customModal.muscleGroup" list="muscle-groups" maxlength="30" class="cyber-input mb-4 w-full rounded-xl p-3.5 text-sm" :placeholder="t('custom.musclePlaceholder')">
              <datalist id="muscle-groups"><option v-for="m in allMuscleGroups" :key="m" :value="m"></option></datalist>

              <label class="label-xs mb-2">{{ t('custom.tracking') }}</label>
              <div class="mb-6 space-y-2">
                  <button type="button" v-for="type in (['WeightReps', 'DistanceTime', 'Duration', 'Cardio'] as const)" :key="type"
                          @click="customModal.trackingType = type" class="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all"
                          :class="customModal.trackingType === type ? 'border-accent/60 bg-accent/10' : 'border-white/5 bg-black/20 hover:border-white/20'">
                      <span><span class="block text-sm font-bold text-white">{{ t(`tracking.${type}`) }}</span><span class="font-mono text-[10px] text-slate-500">{{ t(`tracking.hint.${type}`) }}</span></span>
                      <span v-if="customModal.trackingType === type" class="text-accent">●</span>
                  </button>
              </div>

              <!-- Eigenschaften: Gravitron = weniger ist besser; Seitstütz = Werte pro Seite -->
              <div class="mb-6 space-y-2">
                  <label v-if="customModal.trackingType === 'WeightReps'" class="flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
                      <input v-model="customModal.isAssisted" type="checkbox" class="h-5 w-5 flex-shrink-0" data-test="cx-assisted" />
                      <span class="text-sm text-slate-200">{{ t('workout.assisted') }}</span>
                  </label>
                  <label class="flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
                      <input v-model="customModal.perSide" type="checkbox" class="h-5 w-5 flex-shrink-0" data-test="cx-per-side" />
                      <span class="text-sm text-slate-200">{{ t('workout.perSide') }}</span>
                  </label>
              </div>

              <p v-if="customModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ customModal.error }}</p>
              <button type="submit" :disabled="customModal.busy" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ customModal.busy ? t('common.saving') : t('custom.create') }}</button>
          </form>
      </div>
  </transition>
</template>
