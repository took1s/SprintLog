<script setup lang="ts">
// Bibliothek fertiger Routinen: Karten mit Art, Häufigkeit, Dauer und Studien-Hinweis; antippen zeigt die Schritte,
// "Übernehmen" öffnet den Editor mit der Vorlage (Trainingstage aus dem Wochenplan, Zeitraum ab heute).
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { EVERY_DAY } from '@/lib/routines';
import { countDays } from '@/lib/schedule';
import { ROUTINE_LIBRARY, libraryDays, libraryDraft, libraryView, type LibraryTemplate } from '@/lib/routineLibrary';
import { vSheetDrag } from '@/lib/gestures';
import RoutineStepRow from './RoutineStepRow.vue';

const app = useAppStore();
const routines = useRoutinesStore();
const { libraryOpen, today } = storeToRefs(routines);

const schedule = computed(() => app.activeProgram ?? null);
const items = computed(() => ROUTINE_LIBRARY.map(libraryView));
const open = ref<string | null>(null);
watch(libraryOpen, (v) => { if (v) open.value = null; });

function frequency(tpl: LibraryTemplate): string {
  if (tpl.days === 'training' && schedule.value?.trainingDays) return t('routineLibrary.onTraining');
  if (tpl.days === 'afterMatch' && schedule.value?.matchDays) return t('routineLibrary.afterMatch');
  const mask = libraryDays(tpl, schedule.value);
  return mask === EVERY_DAY ? t('routineLibrary.daily') : t('routineLibrary.perWeek', { n: countDays(mask) });
}

function use(tpl: LibraryTemplate) {
  routines.useTemplate(libraryDraft(tpl, today.value, schedule.value));
}
</script>

<template>
  <transition name="sheet">
      <div v-if="libraryOpen" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="routines.closeLibrary()" @keydown.esc.stop="routines.closeLibrary()">
          <section v-sheet-drag:handle="() => routines.closeLibrary()" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
                   role="dialog" aria-modal="true" aria-labelledby="library-title" data-test="routine-library">
              <div class="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
                  <div class="min-w-0">
                      <h2 id="library-title" class="display mt-1 text-2xl leading-tight text-white">{{ t('routineLibrary.title') }}</h2>
                      <p class="mt-1 text-xs leading-snug text-slate-400">{{ t('routineLibrary.intro') }}</p>
                  </div>
                  <button type="button" @click="routines.closeLibrary()" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <ul class="stagger flex-1 space-y-2 overflow-y-auto px-6 pb-6 pt-2">
                  <li v-for="v in items" :key="v.tpl.id" class="lib-card" :class="{ 'is-open': open === v.tpl.id }" :data-template="v.tpl.id">
                      <button type="button" class="flex w-full items-start gap-3 p-3 text-left" :aria-expanded="open === v.tpl.id" @click="open = open === v.tpl.id ? null : v.tpl.id">
                          <span class="lib-icon" :data-kind="v.tpl.kind" aria-hidden="true">
                              <svg v-if="v.tpl.kind === 'prevention'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linejoin="round" d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/></svg>
                              <svg v-else-if="v.tpl.kind === 'activation'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linejoin="round" d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
                              <svg v-else-if="v.tpl.kind === 'recovery'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>
                              <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v5l-4 7M12 13l4 7M6 10.5l6-1 6 1"/></svg>
                          </span>
                          <span class="min-w-0 flex-1">
                              <span class="block break-words font-bold leading-snug text-white">{{ v.title }}</span>
                              <span class="mt-0.5 block text-xs leading-snug text-slate-400">{{ v.summary }}</span>
                              <span class="mt-2 flex flex-wrap gap-1.5">
                                  <span class="lib-chip">{{ t(`routines.kinds.${v.tpl.kind}`) }}</span>
                                  <span class="lib-chip">{{ frequency(v.tpl) }}</span>
                                  <span class="lib-chip">{{ v.tpl.weeks ? tn('routineLibrary.weeks', v.tpl.weeks) : t('routineLibrary.ongoing') }}</span>
                                  <span class="lib-chip">{{ t('routineLibrary.minutes', { n: v.tpl.minutes }) }}</span>
                                  <span v-if="v.tpl.evidence" class="lib-chip is-evidence">
                                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>{{ t('routineLibrary.evidence') }}
                                  </span>
                              </span>
                          </span>
                      </button>
                      <transition name="expand">
                          <div v-if="open === v.tpl.id" class="expand-wrap">
                              <div class="px-3 pb-3">
                                  <p class="rounded-xl bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-slate-300">{{ v.note }}</p>
                                  <p class="label-xs mb-2 mt-3">{{ t('routineLibrary.steps') }}</p>
                                  <ol class="space-y-1.5">
                                      <RoutineStepRow v-for="(s, i) in v.steps" :key="i" :index="i" boxed :name="s.name" :dose="s.dose" :exercise-id="s.exerciseId" @info="(id) => app.openExerciseInfo(id, 'overlay')" />
                                  </ol>
                                  <button type="button" class="btn-primary mt-3 w-full rounded-xl py-3.5 text-sm" data-test="library-use" @click="use(v.tpl)">{{ t('routineLibrary.use') }}</button>
                              </div>
                          </div>
                      </transition>
                  </li>
              </ul>
          </section>
      </div>
  </transition>
</template>
