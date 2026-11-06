<script setup lang="ts">
// Vorschlag des KI-Coachs als Karte (Plan, Ziel, Wochenplan). Gespeichert wird nur über den Knopf - die KI ändert nie selbst etwas.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { exerciseName, goalName } from '@/i18n/content';
import { formatDate, formatNumber } from '@/lib/format';
import { WEEKDAYS, bit } from '@/lib/schedule';
import { useAppStore } from '@/stores/app';
import type { AiAction } from '@/stores/ai';

const props = defineProps<{ action: AiAction; applied: boolean; busy: boolean }>();
const emit = defineEmits<{ apply: [] }>();
const { exercisesById } = storeToRefs(useAppStore());

const dayShort = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '');
const dayLong = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'long' });

function prescription(x: { exerciseId: number; sets: number; repsMin?: number | null; repsMax?: number | null; distance?: number | null; time?: number | null }) {
  const ex = exercisesById.value.get(x.exerciseId);
  const name = ex ? exerciseName(ex) : `#${x.exerciseId}`;
  const what = x.distance ? `${x.distance} ${t('units.m')}` : x.time ? `${x.time} ${t('units.s')}` : x.repsMin ? `${x.repsMin}${x.repsMax && x.repsMax !== x.repsMin ? `-${x.repsMax}` : ''}` : '';
  return `${name} ${x.sets}×${what}`;
}

const title = computed(() => t(`ai.actions.${props.action.type}`));
const button = computed(() => (props.action.type === 'program' ? t('ai.actions.saveProgram') : props.action.type === 'goal' ? t('ai.actions.saveGoal') : t('ai.actions.applySchedule')));
const goalExercise = computed(() => {
  if (props.action.type !== 'goal') return '';
  const ex = exercisesById.value.get(props.action.exerciseId);
  return ex ? exerciseName(ex) : props.action.exerciseName;
});
const kind = (d: number) => {
  if (props.action.type !== 'schedule') return 'rest';
  return props.action.matchDays & bit(d) ? 'match' : props.action.trainingDays & bit(d) ? 'training' : 'rest';
};
</script>

<template>
  <div class="mt-2 rounded-2xl border border-accent/40 bg-black/20 p-3.5" :data-action="action.type">
      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ title }}</p>

      <template v-if="action.type === 'program'">
          <p class="mt-1 break-words font-bold leading-tight text-white">{{ action.program.name }}</p>
          <p class="mt-0.5 font-mono text-[11px] text-slate-400">{{ goalName(action.program.goal) }} · {{ t('builder.perWeek', { n: action.program.days.length }) }} · {{ tn('units.weeks', action.program.weeks) }}</p>
          <p v-if="action.summary" class="mt-2 text-sm leading-snug text-slate-200">{{ action.summary }}</p>
          <details class="mt-2 group">
              <summary class="flex min-h-[2.75rem] cursor-pointer list-none items-center text-xs font-bold text-slate-300 hover:text-white">{{ tn('units.days', action.program.days.length) }} ›</summary>
              <ol class="space-y-2">
                  <li v-for="(d, i) in action.program.days" :key="i" class="rounded-xl bg-white/[0.04] p-2.5">
                      <p class="text-[11px] font-bold uppercase text-slate-300 tracking-label">{{ d.name }}</p>
                      <ul class="mt-1 space-y-0.5"><li v-for="x in d.exercises" :key="x.exerciseId" class="text-sm text-slate-200">{{ prescription(x) }}</li></ul>
                  </li>
              </ol>
          </details>
      </template>

      <template v-else-if="action.type === 'goal'">
          <p class="mt-1 break-words font-bold leading-tight text-white">{{ goalExercise }}</p>
          <p class="mt-0.5 font-mono text-base font-black text-white">{{ formatNumber(action.targetWeight, 2) }} {{ t('units.kg') }} × {{ action.targetReps }}
              <span v-if="action.targetDate" class="text-[11px] font-normal text-slate-400">{{ t('ai.actions.by', { date: formatDate(action.targetDate, { day: 'numeric', month: 'short', year: 'numeric' }) }) }}</span>
          </p>
          <p v-if="action.reason" class="mt-1.5 text-sm leading-snug text-slate-300">{{ action.reason }}</p>
      </template>

      <template v-else>
          <ul class="mt-2 grid grid-cols-7 gap-1">
              <li v-for="d in WEEKDAYS" :key="d" class="rounded-lg border py-1.5 text-center text-[10px] font-bold uppercase tracking-label" :aria-label="`${dayLong(d)}: ${t(`schedule.kind.${kind(d)}`)}`"
                  :class="kind(d) === 'match' ? 'border-yellow-400 bg-yellow-400/15 text-yellow-300' : kind(d) === 'training' ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-slate-400'">
                  <span aria-hidden="true">{{ dayShort(d) }}</span>
              </li>
          </ul>
          <p v-if="action.reason" class="mt-2 text-sm leading-snug text-slate-300">{{ action.reason }}</p>
      </template>

      <button type="button" @click="emit('apply')" :disabled="applied || busy" :aria-busy="busy"
              class="mt-3 flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold" :class="applied ? 'border border-emerald-400/40 text-emerald-300' : 'btn-primary'" data-test="ai-action-apply">
          <span v-if="busy" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
          {{ applied ? `✓ ${t('ai.actions.saved')}` : button }}
      </button>
  </div>
</template>
