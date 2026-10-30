<script setup lang="ts">
// Übungen zur Einheit hinzufügen: suchen (alle Sprachen + Slang), zuletzt genutzt, Favoriten, mehrere auf einmal.
import { nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { exerciseName, muscleName } from '@/i18n/content';
import { useAppStore, type PickerFilter } from '@/stores/app';

const app = useAppStore();
const { picker, pickerMuscles, pickerResults } = storeToRefs(app);
const { confirmPicker, lastSetLabel, openCustomModal, togglePicked } = app;

const FILTERS: PickerFilter[] = ['recent', 'favorites', 'all'];
const searchInput = ref<HTMLInputElement | null>(null);

watch(() => picker.value.open, async (open) => {
  if (!open) return;
  await nextTick();
  // Auf Touch-Geräten nicht sofort die Tastatur öffnen - zuerst sieht man "Zuletzt".
  if (window.matchMedia?.('(pointer: fine)').matches) searchInput.value?.focus();
});

function createCustom() {
  const name = picker.value.query.trim();
  picker.value.open = false;
  openCustomModal(name);
}
</script>

<template>
  <transition name="fade">
      <div v-if="picker.open" class="backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" @click.self="picker.open = false">
          <div class="modal-panel glass-panel flex h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:h-[80vh] sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="t('picker.title')">
              <div class="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
                  <h2 class="display text-2xl text-white">{{ t('picker.title') }}</h2>
                  <button type="button" @click="picker.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="px-5">
                  <label class="field flex items-center gap-2 rounded-xl px-3">
                      <svg class="h-5 w-5 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input ref="searchInput" v-model="picker.query" type="search" :placeholder="t('picker.search')" :aria-label="t('picker.search')"
                             class="h-12 w-full bg-transparent text-white outline-none placeholder:text-slate-500" data-test="picker-search">
                      <button v-if="picker.query" type="button" @click="picker.query = ''" class="-mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center text-slate-400 hover:text-white" :aria-label="t('common.clear')">✕</button>
                  </label>

                  <template v-if="!picker.query.trim()">
                      <div class="mt-3 flex gap-1 rounded-xl bg-white/5 p-1" role="tablist">
                          <button v-for="f in FILTERS" :key="f" type="button" role="tab" :aria-selected="picker.filter === f" @click="picker.filter = f"
                                  class="flex-1 rounded-lg py-2 text-xs font-bold transition-colors" :class="picker.filter === f ? 'bg-surface text-white shadow-sm' : 'text-slate-400'">{{ t(`picker.filters.${f}`) }}</button>
                      </div>
                      <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
                          <button type="button" @click="picker.category = 'Gym'; picker.muscle = null" class="chip flex-shrink-0" :class="picker.category === 'Gym' ? 'chip-active' : 'chip-idle'">{{ t('categories.Gym') }}</button>
                          <button type="button" @click="picker.category = 'Football'; picker.muscle = null" class="chip flex-shrink-0" :class="picker.category === 'Football' ? 'chip-active' : 'chip-idle'">{{ t('categories.Football') }}</button>
                          <span class="mx-1 w-px flex-shrink-0 bg-white/10" aria-hidden="true"></span>
                          <button v-for="m in pickerMuscles" :key="m" type="button" @click="picker.muscle = picker.muscle === m ? null : m"
                                  class="chip flex-shrink-0" :class="picker.muscle === m ? 'chip-active' : 'chip-idle'">{{ muscleName(m) }}</button>
                      </div>
                  </template>
              </div>

              <ul class="mt-2 flex-1 overflow-y-auto px-3 pb-4" role="listbox" aria-multiselectable="true" :aria-label="t('picker.title')">
                  <li v-for="{ e, inWorkout } in pickerResults" :key="e.id">
                      <button type="button" role="option" :aria-selected="picker.selected.includes(e.id)" :disabled="inWorkout" @click="togglePicked(e.id)"
                              class="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-white/5 disabled:opacity-50" :data-pick="e.id">
                          <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                                :class="picker.selected.includes(e.id) || inWorkout ? 'border-accent bg-accent text-on-accent' : 'border-white/45'" aria-hidden="true">
                              <svg v-if="picker.selected.includes(e.id) || inWorkout" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                          </span>
                          <span class="min-w-0 flex-1">
                              <span class="block truncate font-bold text-white">{{ exerciseName(e) }}</span>
                              <span class="block truncate font-mono text-[11px] text-slate-500">
                                  {{ muscleName(e.muscleGroup) }}<template v-if="inWorkout"> · {{ t('picker.inWorkout') }}</template><template v-else-if="lastSetLabel(e)"> · {{ lastSetLabel(e) }}</template>
                              </span>
                          </span>
                      </button>
                  </li>
                  <li v-if="!pickerResults.length" class="px-4 py-10 text-center text-sm text-slate-500">
                      {{ picker.query.trim() ? t('picker.noResults', { query: picker.query.trim() }) : picker.filter === 'recent' ? t('picker.noRecent') : t('picker.noFavorites') }}
                  </li>
                  <li class="px-2 pt-2">
                      <button type="button" @click="createCustom" class="w-full rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-slate-400 hover:border-accent/50 hover:text-accent">
                          {{ picker.query.trim() ? t('catalog.createNamed', { name: picker.query.trim() }) : t('catalog.customExercise') }}
                      </button>
                  </li>
              </ul>

              <div class="border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button type="button" @click="confirmPicker" :disabled="!picker.selected.length" data-test="picker-add" class="btn-primary w-full rounded-xl py-4 text-sm">
                      {{ picker.selected.length ? tn('picker.add', picker.selected.length) : t('picker.choose') }}
                  </button>
              </div>
          </div>
      </div>
  </transition>
</template>
