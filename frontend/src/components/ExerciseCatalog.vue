<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, sortOptions } from '@/stores/app';

const app = useAppStore();
const { availableMuscleGroups, exercises, favorites, filteredExercises, loadingExercises, muscleFilters, search, sortLabel, sortMode, sortOpen, usage } = storeToRefs(app);
const { lastSetLabel, openCustomModal, openSetModal, selectSort, toggleFavorite, toggleMuscleFilter } = app;
</script>

<template>
  <div class="mb-6 flex flex-col gap-3 sm:flex-row">
      <div class="glass-panel flex flex-1 items-center rounded-2xl p-2.5 transition-all focus-within:border-accent/50">
          <svg class="ml-2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="search" placeholder="Search exercises..." aria-label="Search exercises"
                 class="ml-3 w-full bg-transparent font-mono text-sm text-white outline-none placeholder:text-slate-600">
          <button v-if="search" @click="search = ''" class="px-3 text-xs text-slate-500 hover:text-white">Clear</button>
      </div>

      <div class="relative sm:w-56">
          <div v-if="sortOpen" @click="sortOpen = false" class="fixed inset-0 z-20"></div>
          <button @click="sortOpen = !sortOpen" class="glass-panel relative z-30 flex w-full items-center justify-between rounded-2xl p-3 transition-all hover:border-accent/50" :aria-expanded="sortOpen">
              <span class="flex items-center">
                  <svg class="ml-1 mr-3 h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
                  <span class="select-none text-[10px] font-bold uppercase tracking-widest text-white">{{ sortLabel }}</span>
              </span>
              <svg :class="{ 'rotate-180': sortOpen }" class="mr-1 h-4 w-4 text-accent transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <transition name="slide-up">
              <div v-if="sortOpen" class="glass-panel absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-accent/30">
                  <button v-for="o in sortOptions" :key="o.key" @click="selectSort(o.key)"
                          class="flex w-full items-center gap-2 border-t border-white/5 p-4 text-left text-[10px] font-bold uppercase tracking-widest transition-colors first:border-t-0 hover:bg-accent/20"
                          :class="sortMode === o.key ? 'bg-accent/10 text-accent' : 'text-slate-300'">
                      <span v-if="sortMode === o.key">➤</span> {{ o.label }}
                  </button>
              </div>
          </transition>
      </div>
  </div>

  <div class="mb-6 flex flex-wrap gap-2">
      <button @click="muscleFilters = []" class="chip" :class="muscleFilters.length === 0 ? 'chip-active' : 'chip-idle'">All</button>
      <button v-for="m in availableMuscleGroups" :key="m" @click="toggleMuscleFilter(m)" class="chip" :class="muscleFilters.includes(m) ? 'chip-active' : 'chip-idle'">{{ m }}</button>
  </div>

  <div v-if="loadingExercises" class="flex justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
  </div>

  <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div v-for="ex in filteredExercises" :key="ex.id" @click="openSetModal(ex)" @keydown.enter="openSetModal(ex)" tabindex="0" role="button"
           class="glass-panel group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl p-5 transition-all hover:border-accent/40">
          <div class="relative z-10 min-w-0 pr-2">
              <h3 class="truncate text-lg font-bold text-slate-100 transition-colors group-hover:text-accent">{{ ex.name }}</h3>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <span class="rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-accent">{{ ex.muscleGroup || 'Other' }}</span>
                  <span v-if="ex.trackingType !== 'WeightReps'" class="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400">{{ ex.trackingType === 'Duration' ? 'Time' : 'Dist/Time' }}</span>
                  <span v-if="ex.isCustom" class="rounded-md border border-purple-400/20 bg-purple-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-purple-300">Custom</span>
                  <span v-if="usage.get('id:' + ex.id)" class="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 font-mono text-[9px] font-bold text-orange-400">{{ usage.get('id:' + ex.id) }} sets</span>
              </div>
              <p v-if="lastSetLabel(ex)" class="mt-2 truncate font-mono text-[10px] text-slate-500">Last: {{ lastSetLabel(ex) }}</p>
          </div>
          <div class="z-10 flex items-center gap-3">
              <button @click.stop="toggleFavorite(ex)" class="p-1 transition-transform hover:scale-125" :aria-label="favorites.includes(ex.id) ? 'Remove favorite' : 'Add favorite'">
                  <svg v-if="favorites.includes(ex.id)" class="h-6 w-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  <svg v-else class="h-6 w-6 text-slate-600 hover:text-yellow-400/60" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
              </button>
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-black/40 text-slate-500 transition-all group-hover:border-accent/50 group-hover:bg-accent/20 group-hover:text-accent">+</div>
          </div>
      </div>

      <button @click="openCustomModal" class="flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 p-5 text-slate-500 transition-all hover:border-accent/50 hover:text-accent">
          <span class="text-2xl font-light">+</span>
          <span class="text-[10px] font-bold uppercase tracking-widest">{{ search ? `Create "${search}"` : 'Custom exercise' }}</span>
      </button>
  </div>

  <p v-if="!loadingExercises && !exercises.length" class="glass-panel mt-4 rounded-2xl p-6 text-center font-mono text-xs text-slate-500">
      Exercise catalog not loaded yet. Connect once to download it - afterwards it works offline.
  </p>
</template>
