<script setup lang="ts">
// Heute fällige Routinen als Checkliste auf dem Start-Bildschirm: abhaken mit einem Tipp (bei mehrmals täglich zählt
// jeder Tipp einen Durchgang), aufklappen für Schritte, Durchgänge einzeln, Nachtragen eines verpassten Tages und Verlauf.
// Ohne fällige Routine erscheint nichts.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { parseDay, type Routine } from '@/lib/routines';
import { tap as haptic } from '@/lib/native';
import RoutineMeta from './RoutineMeta.vue';
import RoutineStepRow from './RoutineStepRow.vue';

const app = useAppStore();
const routines = useRoutinesStore();
const { forToday } = storeToRefs(routines);

const doneCount = computed(() => forToday.value.filter((r) => routines.progressOf(r).doneToday).length);
const allDone = computed(() => forToday.value.length > 0 && doneCount.value === forToday.value.length);
const open = ref<string | null>(null);
const toggleOpen = (id: string) => { open.value = open.value === id ? null : id; };
/** Gerade abgehakt: kurze Bestätigungs-Animation. */
const justDone = ref<string | null>(null);

const p = (r: Routine) => routines.progressOf(r);
const date = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });

/** Großer Haken: nächster Durchgang - ist alles erledigt, wird der letzte wieder gelöst. */
function main(r: Routine) {
  const before = p(r);
  routines.tap(r.clientId, Math.min(before.countToday + 1, r.timesPerDay));
  haptic();
  // Der Store ersetzt das Objekt beim Abhaken -> aktuellen Stand neu holen (sonst bleibt die Animation aus)
  const fresh = routines.byId(r.clientId);
  const nowDone = !!fresh && p(fresh).doneToday;
  justDone.value = nowDone && !before.doneToday ? r.clientId : null;
  if (justDone.value) window.setTimeout(() => { if (justDone.value === r.clientId) justDone.value = null; }, 700);
}

/** Ring um den Haken: Anteil der heutigen Durchgänge (Kreisumfang 2π·19). */
const RING = 2 * Math.PI * 19;
const ringOffset = (r: Routine) => RING * (1 - Math.min(1, p(r).countToday / r.timesPerDay));

function mainLabel(r: Routine) {
  if (r.timesPerDay === 1) return p(r).doneToday ? t('routines.markOpen', { title: r.title }) : t('routines.markDone', { title: r.title });
  return t('routines.tickLabel', { title: r.title, done: p(r).countToday, total: r.timesPerDay });
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
                  <button type="button" class="routine-check" :class="{ 'is-done': p(r).doneToday, 'is-pop': justDone === r.clientId, 'is-multi': r.timesPerDay > 1 }"
                          :aria-pressed="p(r).doneToday" :aria-label="mainLabel(r)" data-test="routine-check" @click="main(r)">
                      <svg v-if="r.timesPerDay > 1 && !p(r).doneToday" class="routine-ring" viewBox="0 0 44 44" aria-hidden="true">
                          <circle cx="22" cy="22" r="19" class="routine-ring-track" />
                          <circle cx="22" cy="22" r="19" class="routine-ring-fill" :style="{ strokeDasharray: RING, strokeDashoffset: ringOffset(r) }" />
                      </svg>
                      <span v-if="r.timesPerDay > 1 && !p(r).doneToday" class="routine-count" aria-hidden="true">{{ p(r).countToday }}/{{ r.timesPerDay }}</span>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path class="routine-check-path" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  </button>
                  <button type="button" class="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left" :aria-expanded="open === r.clientId" @click="toggleOpen(r.clientId)">
                      <span class="min-w-0 flex-1">
                          <span class="line-clamp-2 break-words text-sm font-bold leading-snug" :class="p(r).doneToday ? 'text-slate-400 line-through decoration-1' : 'text-white'">{{ r.title }}</span>
                          <RoutineMeta :routine="r" compact />
                      </span>
                      <span v-if="p(r).missedRecent" class="routine-missed-dot" :title="t('routines.missedOn', { date: date(p(r).missedRecent!) })" aria-hidden="true"></span>
                      <svg class="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': open === r.clientId }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
                  </button>
              </div>
              <div v-if="open === r.clientId" class="mb-1 ml-12 mt-1" data-test="routine-today-steps">
                  <!-- Mehrmals täglich: jeder Durchgang einzeln -->
                  <div v-if="r.timesPerDay > 1" class="mb-2 flex flex-wrap items-center gap-1.5" role="group" :aria-label="t('routines.rounds')">
                      <button v-for="k in r.timesPerDay" :key="k" type="button" class="routine-pip" :class="{ 'is-on': k <= p(r).countToday }"
                              :aria-pressed="k <= p(r).countToday" :aria-label="t('routines.round', { n: k })" :data-pip="k" @click="routines.tap(r.clientId, k)">{{ k }}</button>
                  </div>
                  <ol class="space-y-1.5">
                      <RoutineStepRow v-for="(s, i) in r.steps" :key="i" :name="s.name" :dose="s.dose" :exercise-id="s.exerciseId" @info="(id) => app.openExerciseInfo(id, 'overlay')" />
                  </ol>
                  <p v-if="r.reason" class="pt-1 text-[11px] leading-snug text-slate-400">{{ r.reason }}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                      <button v-if="p(r).missedRecent" type="button" class="routine-link" data-test="routine-catch-up" @click="routines.setDone(r.clientId, true, p(r).missedRecent!)">
                          {{ t('routines.catchUp', { date: date(p(r).missedRecent!) }) }}
                      </button>
                      <button type="button" class="routine-link" data-test="routine-history" @click="routines.openDetail(r.clientId)">{{ t('routines.history') }}</button>
                  </div>
              </div>
          </li>
      </ul>
  </section>
</template>
