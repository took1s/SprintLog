<script setup lang="ts">
import { t } from '@/i18n';
import { exerciseName, muscleName } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore, sortOptions } from '@/stores/app';
import { vLongPress } from '@/lib/gestures';

const app = useAppStore();
const { availableMuscleGroups, exercises, favorites, filteredExercises, loadingExercises, muscleFilters, search, sortLabel, sortMode, sortOpen } = storeToRefs(app);
const { addFromCatalog, lastSetLabel, openCustomModal, openExerciseInfo, openSetModal, selectSort, toggleFavorite, toggleMuscleFilter } = app;
</script>

<template>
  <div class="mb-3 flex flex-col gap-2 sm:flex-row">
      <div class="catalog-search glass-panel flex flex-1 items-center rounded-2xl p-2.5 transition-all focus-within:border-accent/50">
          <svg class="ml-2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="search" :placeholder="t('catalog.search')" :aria-label="t('catalog.search')"
                 class="ml-3 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500">
          <button v-if="search" @click="search = ''" class="px-3 text-xs text-slate-500 hover:text-white">{{ t('common.clear') }}</button>
      </div>

      <div class="relative sm:w-56">
          <div v-if="sortOpen" @click="sortOpen = false" class="fixed inset-0 z-20"></div>
          <button @click="sortOpen = !sortOpen" class="glass-panel relative z-30 flex w-full items-center justify-between rounded-2xl p-3 transition-all hover:border-accent/50" :aria-expanded="sortOpen">
              <span class="flex items-center">
                  <svg class="ml-1 mr-3 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
                  <span class="select-none text-[13px] font-semibold text-white">{{ t('catalog.sortBy') }}: {{ sortLabel }}</span>
              </span>
              <svg :class="{ 'rotate-180': sortOpen }" class="mr-1 h-4 w-4 text-slate-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <transition name="slide-up">
              <div v-if="sortOpen" class="glass-panel modal-panel absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl shadow-2xl">
                  <button v-for="o in sortOptions" :key="o.key" @click="selectSort(o.key)"
                          class="flex min-h-[3rem] w-full items-center justify-between gap-2 border-t border-white/5 px-4 text-left text-[15px] transition-colors first:border-t-0 hover:bg-white/5"
                          :class="sortMode === o.key ? 'font-semibold text-white' : 'text-slate-300'" :aria-pressed="sortMode === o.key">
                      {{ t(`catalog.sort.${o.key}`) }}
                      <svg v-if="sortMode === o.key" class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L20 7"/></svg>
                  </button>
              </div>
          </transition>
      </div>
  </div>

  <!-- Muskelgruppen: eine wischbare Zeile statt vier umbrechender -->
  <div class="catalog-filters no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:-mx-8 sm:px-8" role="group" :aria-label="t('catalog.title')">
      <button @click="muscleFilters = []" class="chip flex-shrink-0" :class="muscleFilters.length === 0 ? 'chip-active' : 'chip-idle'" :aria-pressed="muscleFilters.length === 0">{{ t('common.all') }}</button>
      <button v-for="m in availableMuscleGroups" :key="m" @click="toggleMuscleFilter(m)" class="chip flex-shrink-0" :class="muscleFilters.includes(m) ? 'chip-active' : 'chip-idle'" :aria-pressed="muscleFilters.includes(m)">{{ muscleName(m) }}</button>
  </div>

  <div v-if="loadingExercises" class="flex justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
  </div>

  <!-- Liste statt Kartenraster: Name, darunter Muskelgruppe und letzter Satz - drei Mal so viele Übungen pro Bildschirm -->
  <div v-else class="catalog-list glass-panel overflow-hidden rounded-2xl">
      <!-- Antippen = Satz loggen, gedrückt halten = Technik & eigene Werte (Vorschau wie Haptic Touch) -->
      <div v-for="ex in filteredExercises" :key="ex.id" @click="openSetModal(ex)" @keydown.enter="openSetModal(ex)" tabindex="0" role="button"
           v-long-press="() => openExerciseInfo(ex.id, 'catalog')" :data-ex="ex.id" class="catalog-card catalog-row">
          <div class="min-w-0 flex-1">
              <h3 class="catalog-name">{{ exerciseName(ex) }}</h3>
              <p class="catalog-meta">
                  <span>{{ muscleName(ex.muscleGroup) }}</span>
                  <template v-if="ex.trackingType !== 'WeightReps'"> · {{ ex.trackingType === 'Duration' ? t('tracking.short.Duration') : t('tracking.short.DistanceTime') }}</template>
                  <template v-if="ex.isCustom"> · <span class="text-purple-400">{{ t('common.custom') }}</span></template>
                  <template v-if="lastSetLabel(ex)"> · {{ lastSetLabel(ex) }}</template>
              </p>
          </div>
          <button @click.stop="toggleFavorite(ex)" class="catalog-icon-btn" :aria-pressed="favorites.includes(ex.id)" :aria-label="favorites.includes(ex.id) ? t('catalog.removeFavorite') : t('catalog.addFavorite')">
              <svg v-if="favorites.includes(ex.id)" class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
              <svg v-else class="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
          </button>
          <button type="button" @click.stop="addFromCatalog(ex)" :aria-label="t('catalog.addToWorkout', { name: exerciseName(ex) })" :data-add="ex.id" class="catalog-add">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
          </button>
      </div>

      <button @click="openCustomModal()" class="catalog-row w-full text-left text-accent">
          <span class="catalog-add flex-shrink-0" aria-hidden="true"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg></span>
          <span class="min-w-0 flex-1 truncate text-[15px] font-semibold">{{ search ? t('catalog.createNamed', { name: search }) : t('catalog.customExercise') }}</span>
      </button>
  </div>

  <p v-if="!loadingExercises && !exercises.length" class="glass-panel mt-4 rounded-2xl p-6 text-center font-mono text-xs text-slate-500">
      {{ t('catalog.notLoaded') }}
  </p>
</template>
