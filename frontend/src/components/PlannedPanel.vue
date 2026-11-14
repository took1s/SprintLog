<script setup lang="ts">
// Zusatz-Einheiten im Plan-Tab: anstehende (mit Warnung, falls ein geänderter Wochenplan jetzt kollidiert), vergangene
// der letzten 30 Tage eingeklappt mit Status. Tippen = bearbeiten.
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { exerciseName, categoryName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { usePlannedStore } from '@/stores/planned';
import { parseDay } from '@/lib/routines';
import { displayStatus, type PlannedWorkout } from '@/lib/planned';

const app = useAppStore();
const planned = usePlannedStore();
const { next, recent, today } = storeToRefs(planned);

const date = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
const names = (p: PlannedWorkout) => p.exercises.map((x) => exerciseName(app.exerciseFor(x.exerciseId) ?? x.exerciseId)).join(' · ');
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="planned-panel">
      <div class="mb-4 flex items-center justify-between gap-3">
          <div>
              <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('planned.kicker') }}</p>
              <h2 class="display text-2xl text-white">{{ t('planned.title') }}</h2>
          </div>
          <button type="button" @click="planned.openNew()" class="btn-secondary flex-shrink-0 rounded-xl px-4 py-2.5 text-xs" data-test="planned-new">+ {{ t('planned.add') }}</button>
      </div>

      <p v-if="!next.length && !recent.length" class="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm leading-relaxed text-slate-400">{{ t('planned.empty') }}</p>

      <ul v-if="next.length" class="space-y-2">
          <li v-for="p in next" :key="p.clientId">
              <button type="button" class="planned-row w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/5" :data-planned-row="p.clientId" @click="planned.openEdit(p.clientId)">
                  <span class="planned-date" :class="{ 'is-today': p.date === today }" aria-hidden="true">
                      <span class="planned-date-wd">{{ parseDay(p.date).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '') }}</span>
                      <span class="planned-date-d">{{ parseDay(p.date).getDate() }}</span>
                  </span>
                  <span class="min-w-0 flex-1">
                      <span class="flex items-center gap-2">
                          <span class="truncate font-bold text-white">{{ p.title }}</span>
                          <span v-if="p.source === 'coach'" class="routine-coach-tag flex-shrink-0">{{ t('planned.byCoach') }}</span>
                      </span>
                      <span class="block truncate font-mono text-[11px] text-slate-400"><span class="sr-only">{{ date(p.date) }} · </span>{{ categoryName(p.category) }} · {{ tn('planned.exercises', p.exercises.length) }}</span>
                      <span class="block truncate text-xs text-slate-300">{{ names(p) }}</span>
                      <span v-if="planned.conflictOf(p)" class="mt-1 block text-[11px] font-bold text-yellow-300">{{ t('planned.conflictNow') }}</span>
                      <span v-if="p.pending" class="block font-mono text-[10px] text-slate-500">{{ t('routines.pendingSync') }}</span>
                  </span>
              </button>
          </li>
      </ul>

      <details v-if="recent.length" class="group mt-3">
          <summary class="-mx-1 flex min-h-[2.75rem] cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
              {{ t('planned.recent') }} · {{ recent.length }}
              <svg class="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
          </summary>
          <ul class="space-y-1.5">
              <li v-for="p in recent" :key="p.clientId" class="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2" :data-planned-past="p.clientId">
                  <span class="w-16 flex-shrink-0 font-mono text-[11px] text-slate-400">{{ date(p.date) }}</span>
                  <span class="min-w-0 flex-1 truncate text-sm text-slate-200">{{ p.title }}</span>
                  <span class="planned-status flex-shrink-0" :data-status="displayStatus(p, today)">{{ t(`planned.status.${displayStatus(p, today)}`) }}</span>
                  <button v-if="displayStatus(p, today) === 'missed'" type="button" class="routine-link flex-shrink-0" @click="planned.move(p.clientId)">{{ t('planned.move') }}</button>
              </li>
          </ul>
      </details>
  </section>
</template>
