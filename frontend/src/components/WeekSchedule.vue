<script setup lang="ts">
// Wochenplan des aktiven Programms: Trainings-, Spiel- und Ruhetage. Antippen im Bearbeiten-Modus schaltet um.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t, intlLocale } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { countDays, cycleDay, hasSchedule, kindOf, scheduleWarnings, suggestTrainingDays, WEEKDAYS, weekdayOf, type DayKind, type Schedule } from '@/lib/schedule';
import { formatDate } from '@/lib/format';
import type { TrainingProgram } from '@/types';

const props = defineProps<{ program: TrainingProgram; sessionsPerWeek: number }>();

const app = useAppStore();
const { clockDate, todayPlan } = storeToRefs(app);
const { setSchedule } = app;

const editing = ref(false);
const draft = ref<Schedule>({ trainingDays: 0, matchDays: 0 });

const current = computed<Schedule>(() => (editing.value ? draft.value : { trainingDays: props.program.trainingDays ?? 0, matchDays: props.program.matchDays ?? 0 }));
const today = computed(() => weekdayOf(clockDate.value));
// 1.1.2024 war ein Montag
const label = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '');
const warnings = computed(() => scheduleWarnings(current.value));
const trainingCount = computed(() => countDays(current.value.trainingDays));

function startEdit() {
  draft.value = hasSchedule(props.program)
    ? { trainingDays: props.program.trainingDays ?? 0, matchDays: props.program.matchDays ?? 0 }
    : { trainingDays: suggestTrainingDays(props.sessionsPerWeek), matchDays: 0 };
  editing.value = true;
}
function tapDay(d: number) { if (editing.value) draft.value = cycleDay(draft.value, d); }
function suggest() { draft.value = { ...draft.value, trainingDays: suggestTrainingDays(props.sessionsPerWeek, draft.value.matchDays) }; }
async function save() {
  editing.value = false;
  await setSchedule(props.program, draft.value);
}

const pill = (k: DayKind) => ({
  training: 'border-accent bg-accent text-on-accent',
  match: 'border-yellow-400/70 bg-yellow-400/15 text-yellow-300',
  rest: 'border-white/10 bg-white/[0.03] text-slate-400',
})[k];

const todayLine = computed(() => {
  const p = todayPlan.value;
  if (!p) return '';
  const when = (d: Date | null) => (d ? formatDate(d.toISOString(), { weekday: 'long' }) : '');
  if (p.kind === 'match') return t('schedule.today.match');
  if (p.kind === 'training') return t('schedule.today.training');
  return p.nextTraining ? t('schedule.today.restUntil', { day: when(p.nextTraining) }) : t('schedule.today.rest');
});
</script>

<template>
  <div class="mb-5" data-test="week-schedule">
      <div class="mb-2 flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('schedule.title') }}</span>
          <button v-if="!editing" type="button" @click="startEdit" class="flex min-h-[2.25rem] items-center rounded-lg px-2 text-[11px] font-bold uppercase text-accent tracking-label hover:bg-accent/10" data-test="schedule-edit">
              {{ hasSchedule(program) ? t('common.edit') : t('schedule.set') }}
          </button>
      </div>

      <div class="grid grid-cols-7 gap-1.5" role="group" :aria-label="t('schedule.title')">
          <button v-for="d in WEEKDAYS" :key="d" type="button" @click="tapDay(d)" :disabled="!editing" :data-day="d"
                  class="flex flex-col items-center rounded-xl border py-2 transition-colors disabled:cursor-default"
                  :class="[pill(kindOf(current, d)), d === today && !editing ? 'ring-2 ring-inset ring-white/60' : '', editing ? 'active:scale-95' : '']"
                  :aria-label="`${label(d)}: ${t(`schedule.kind.${kindOf(current, d)}`)}`">
              <span class="text-[10px] font-bold uppercase tracking-label">{{ label(d) }}</span>
              <span class="mt-1 flex h-4 items-center" aria-hidden="true">
                  <svg v-if="kindOf(current, d) === 'training'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
                  <svg v-else-if="kindOf(current, d) === 'match'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7z" fill="currentColor"/></svg>
                  <span v-else class="h-1.5 w-1.5 rounded-full bg-current opacity-60"></span>
              </span>
          </button>
      </div>

      <template v-if="editing">
          <p class="mt-2 text-[11px] leading-relaxed text-slate-400">{{ t('schedule.hint', { count: trainingCount, target: sessionsPerWeek }) }}</p>
          <ul v-if="warnings.length" class="mt-2 space-y-1">
              <li v-for="w in warnings" :key="w" class="text-[11px] font-bold text-orange-300">{{ t(`schedule.warnings.${w}`) }}</li>
          </ul>
          <div class="mt-3 flex gap-2">
              <button type="button" @click="suggest" class="btn-ghost flex-1 rounded-xl py-3 text-xs">{{ t('schedule.suggest') }}</button>
              <button type="button" @click="editing = false" class="btn-ghost rounded-xl px-4 py-3 text-xs">{{ t('common.cancel') }}</button>
              <button type="button" @click="save" class="btn-primary flex-1 rounded-xl py-3 text-xs" data-test="schedule-save">{{ t('common.save') }}</button>
          </div>
      </template>
      <p v-else-if="todayLine" class="mt-2 font-mono text-[11px] text-slate-300" data-test="schedule-today">{{ todayLine }}</p>
      <p v-else class="mt-2 text-[11px] text-slate-500">{{ t('schedule.empty') }}</p>
  </div>
</template>
