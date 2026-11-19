<script setup lang="ts">
// Diese Woche auf einen Blick (Mo-So): Trainings- und Spieltage des Plans, erfasste Einheiten, Zusatz-Einheiten und
// Routinen als Punkte. Tippen zeigt den Tag in einer Zeile darunter.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { usePlannedStore } from '@/stores/planned';
import { indexByDay } from '@/lib/calendar';
import { addDays, parseDay, routinesOnDay } from '@/lib/routines';
import { isTeamDay, kindOf, weekdayOf } from '@/lib/schedule';
import { mdLabel } from '@/lib/matchDay';

const app = useAppStore();
const routines = useRoutinesStore();
const planned = usePlannedStore();
const { allWorkouts, activeProgram } = storeToRefs(app);
const { today } = storeToRefs(routines);

const index = computed(() => indexByDay(allWorkouts.value));
const monday = computed(() => addDays(today.value, -weekdayOf(parseDay(today.value))));

const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const day = addDays(monday.value, i);
  const d = index.value.get(day);
  const r = routinesOnDay(routines.routines, day);
  const extra = planned.items.find((p) => p.date === day && p.pending !== 'delete' && p.status !== 'skipped') ?? null;
  return {
    day,
    date: parseDay(day),
    kind: kindOf(activeProgram.value, i),
    sessions: d?.sessions ?? 0,
    match: !!d?.kinds.includes('Match'),
    team: isTeamDay(activeProgram.value, i) || !!d?.kinds.includes('Team'),
    extra,
    routinesDue: r.due.length,
    routinesDone: r.done,
    md: mdLabel(day, activeProgram.value),
    past: day < today.value,
    isToday: day === today.value,
  };
}));

const selected = ref<string | null>(null);
const shown = computed(() => days.value.find((d) => d.day === (selected.value ?? today.value)) ?? null);
const name = (d: Date) => d.toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '').slice(0, 2);
const longName = (d: Date) => d.toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

function describe(d: (typeof days.value)[number]): string {
  const parts: string[] = [d.kind === 'match' ? t('week.match') : d.kind === 'training' ? t('week.training') : t('week.rest')];
  if (d.team) parts.push(t('week.team'));
  if (d.md && d.md !== 'MD') parts.push(d.md);
  if (d.sessions) parts.push(tn('week.done', d.sessions));
  if (d.extra) parts.push(t('week.extra', { title: d.extra.title }));
  if (d.routinesDue) parts.push(t('week.routines', { done: d.routinesDone, total: d.routinesDue }));
  return parts.join(' · ');
}
</script>

<template>
  <div class="mt-4" data-test="week-strip">
      <div class="week-strip" role="group" :aria-label="t('week.aria')">
          <button v-for="d in days" :key="d.day" type="button" class="week-day" :class="{ 'is-today': d.isToday, 'is-past': d.past, 'is-selected': (selected ?? today) === d.day }"
                  :aria-pressed="(selected ?? today) === d.day" :aria-label="`${longName(d.date)}: ${describe(d)}`" :data-day="d.day" @click="selected = d.day">
              <span class="week-day-name" aria-hidden="true">{{ name(d.date) }}</span>
              <span class="week-day-num" aria-hidden="true">{{ d.date.getDate() }}</span>
              <span v-if="d.md && d.md !== 'MD'" class="week-md" aria-hidden="true">{{ d.md.replace('MD', '') }}</span>
              <span class="week-dots" aria-hidden="true">
                  <i v-if="d.sessions || d.match" class="week-dot" :class="d.match ? 'is-match' : 'is-done'"></i>
                  <i v-else-if="d.kind === 'match'" class="week-dot is-match"></i>
                  <i v-else-if="d.kind === 'training'" class="week-dot is-training"></i>
                  <i v-if="d.team" class="week-dot is-team"></i>
                  <i v-if="d.extra" class="week-dot is-extra"></i>
                  <i v-if="d.routinesDue && !d.past && !d.isToday" class="week-dot is-routines-part"></i>
                  <i v-else-if="d.routinesDue" class="week-dot" :class="d.routinesDone >= d.routinesDue ? 'is-routines' : 'is-routines-part'"></i>
              </span>
          </button>
      </div>
      <transition name="swap" mode="out-in">
          <p v-if="shown" :key="shown.day" class="mt-2 truncate text-[11px] text-slate-400" aria-live="polite" data-test="week-detail">
              <span class="font-bold text-slate-300">{{ shown.isToday ? t('week.today') : longName(shown.date) }}</span> · {{ describe(shown) }}
          </p>
      </transition>
  </div>
</template>
