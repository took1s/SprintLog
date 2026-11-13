<script setup lang="ts">
// Kurzinfo zu einer Routine: Art, Tage, bis wann / wie lange noch, Serie. Kompakt (Start) oder ausführlich (Plan-Tab).
import { computed } from 'vue';
import { intlLocale, t, tn } from '@/i18n';
import { EVERY_DAY, parseDay, type Routine } from '@/lib/routines';
import { WEEKDAYS, bit } from '@/lib/schedule';
import { useRoutinesStore } from '@/stores/routines';

const props = withDefaults(defineProps<{ routine: Routine; compact?: boolean }>(), { compact: false });
const routines = useRoutinesStore();
const p = computed(() => routines.progressOf(props.routine));

const date = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
const days = computed(() => {
  const m = props.routine.days;
  if (m === EVERY_DAY) return t('routines.everyDay');
  return WEEKDAYS.filter((i) => m & bit(i)).map((i) => new Date(2024, 0, 1 + i).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '')).join(' · ');
});
const period = computed(() => {
  const r = props.routine;
  if (p.value.state === 'upcoming') return t('routines.state.upcoming', { date: date(r.startDate) });
  if (p.value.state === 'ended') return t('routines.state.ended', { date: date(r.endDate ?? r.startDate) });
  if (p.value.daysLeft == null) return t('routines.noEnd');
  if (p.value.daysLeft === 0) return t('routines.lastDay');
  return props.compact ? tn('routines.daysLeft', p.value.daysLeft) : `${t('routines.untilDate', { date: date(r.endDate!) })} · ${tn('routines.daysLeft', p.value.daysLeft)}`;
});
</script>

<template>
  <span class="routine-meta block font-mono text-[11px] leading-snug text-slate-400" :class="compact ? 'truncate' : 'break-words'">
      <span class="routine-kind" :data-kind="routine.kind">{{ t(`routines.kinds.${routine.kind}`) }}</span>
      <template v-if="!compact"> · {{ days }}</template>
      · {{ period }}
      <template v-if="compact && p.streak >= 2"> · <span class="routine-streak">{{ tn('routines.streak', p.streak) }}</span></template>
  </span>
</template>
