<script setup lang="ts">
// Heute fällige Routinen als Checkliste auf dem Start-Bildschirm: abhaken mit einem Tipp, Schritte aufklappen,
// verknüpfte Übungen zeigen per Tipp ihre Animation. Ohne fällige Routine erscheint nichts.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import RoutineMeta from './RoutineMeta.vue';

const app = useAppStore();
const routines = useRoutinesStore();
const { forToday } = storeToRefs(routines);

const doneCount = computed(() => forToday.value.filter((r) => routines.progressOf(r).doneToday).length);
const allDone = computed(() => forToday.value.length > 0 && doneCount.value === forToday.value.length);
const open = ref<string | null>(null);
const toggleOpen = (id: string) => { open.value = open.value === id ? null : id; };
/** Gerade abgehakt: kurze Bestätigungs-Animation. */
const justDone = ref<string | null>(null);

function toggle(id: string, done: boolean) {
  routines.setDone(id, !done);
  justDone.value = done ? null : id;
  if (!done) window.setTimeout(() => { if (justDone.value === id) justDone.value = null; }, 700);
}
</script>

<template>
  <section v-if="forToday.length" class="routine-today mt-5 rounded-2xl border p-4" :class="allDone ? 'is-complete' : ''" data-test="routines-today" aria-labelledby="routines-today-title">
      <div class="flex items-baseline justify-between gap-3">
          <h3 id="routines-today-title" class="text-[10px] font-bold uppercase tracking-label" :class="allDone ? 'text-emerald-300' : 'text-accent'">{{ t('routines.todayTitle') }}</h3>
          <span class="font-mono text-[11px] text-slate-400" aria-live="polite">{{ allDone ? t('routines.allDone') : t('routines.doneCount', { done: doneCount, total: forToday.length }) }}</span>
      </div>
      <ul class="mt-2 space-y-1.5">
          <li v-for="r in forToday" :key="r.clientId" class="rounded-xl" :data-routine="r.clientId">
              <div class="flex items-center gap-2">
                  <button type="button" class="routine-check" :class="{ 'is-done': routines.progressOf(r).doneToday, 'is-pop': justDone === r.clientId }"
                          :aria-pressed="routines.progressOf(r).doneToday"
                          :aria-label="routines.progressOf(r).doneToday ? t('routines.markOpen', { title: r.title }) : t('routines.markDone', { title: r.title })"
                          data-test="routine-check" @click="toggle(r.clientId, routines.progressOf(r).doneToday)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path class="routine-check-path" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  </button>
                  <button type="button" class="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left" :aria-expanded="open === r.clientId" @click="toggleOpen(r.clientId)">
                      <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-bold" :class="routines.progressOf(r).doneToday ? 'text-slate-400 line-through decoration-1' : 'text-white'">{{ r.title }}</span>
                          <RoutineMeta :routine="r" compact />
                      </span>
                      <svg class="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': open === r.clientId }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
                  </button>
              </div>
              <ol v-if="open === r.clientId" class="mb-1 ml-12 mt-1 space-y-1" data-test="routine-today-steps">
                  <li v-for="(s, i) in r.steps" :key="i" class="flex items-center gap-2 text-sm">
                      <span class="min-w-0 flex-1 break-words text-slate-200">{{ s.name }}</span>
                      <span v-if="s.dose" class="flex-shrink-0 font-mono text-[11px] text-slate-400">{{ s.dose }}</span>
                      <button v-if="s.exerciseId != null" type="button" class="routine-icon-btn !h-9 !w-9" :aria-label="t('routines.showHow', { name: s.name })" @click="app.openExerciseInfo(s.exerciseId, 'overlay')" data-test="routine-step-info">
                          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
                      </button>
                  </li>
                  <li v-if="r.reason" class="pt-1 text-[11px] leading-snug text-slate-400">{{ r.reason }}</li>
              </ol>
          </li>
      </ul>
  </section>
</template>
