<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { allMuscleGroups, customModal } = storeToRefs(app);
const { saveCustomExercise } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="customModal.open" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="customModal.open = false">
          <form @submit.prevent="saveCustomExercise" class="glass-panel modal-panel w-full max-w-md rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8" role="dialog" aria-modal="true" aria-label="Custom exercise">
              <div class="mb-6 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl font-black text-white">Custom <span class="text-accent">exercise</span></h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">Only visible to you</p>
                  </div>
                  <button type="button" @click="customModal.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" aria-label="Close">✕</button>
              </div>

              <label class="label-xs mb-2" for="cx-name">Name</label>
              <input id="cx-name" v-model="customModal.name" maxlength="60" class="cyber-input mb-4 w-full rounded-xl p-3.5 text-sm" placeholder="e.g. Sled Push">

              <label class="label-xs mb-2">Category</label>
              <div class="mb-4 grid grid-cols-2 gap-2">
                  <button type="button" v-for="c in [['Gym','Gym'],['Football','Field']]" :key="c[0]" @click="customModal.category = c[0]" class="chip" :class="customModal.category === c[0] ? 'chip-active' : 'chip-idle'">{{ c[1] }}</button>
              </div>

              <label class="label-xs mb-2" for="cx-muscle">Muscle group</label>
              <input id="cx-muscle" v-model="customModal.muscleGroup" list="muscle-groups" maxlength="30" class="cyber-input mb-4 w-full rounded-xl p-3.5 text-sm" placeholder="e.g. Legs">
              <datalist id="muscle-groups"><option v-for="m in allMuscleGroups" :key="m" :value="m"></option></datalist>

              <label class="label-xs mb-2">Tracking</label>
              <div class="mb-6 space-y-2">
                  <button type="button" v-for="t in [['WeightReps','Weight × Reps','Strength exercises, bodyweight with 0 kg'],['DistanceTime','Distance + Time','Sprints, shuttles, rowing'],['Duration','Duration','Planks, holds, jump rope']]" :key="t[0]"
                          @click="customModal.trackingType = t[0]" class="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all"
                          :class="customModal.trackingType === t[0] ? 'border-accent/60 bg-accent/10' : 'border-white/5 bg-black/20 hover:border-white/20'">
                      <span><span class="block text-sm font-bold text-white">{{ t[1] }}</span><span class="font-mono text-[10px] text-slate-500">{{ t[2] }}</span></span>
                      <span v-if="customModal.trackingType === t[0]" class="text-accent">●</span>
                  </button>
              </div>

              <p v-if="customModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ customModal.error }}</p>
              <button type="submit" :disabled="customModal.busy" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ customModal.busy ? 'Saving...' : 'Create & log' }}</button>
          </form>
      </div>
  </transition>
</template>
