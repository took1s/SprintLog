<script setup lang="ts">
// Vorschlag des KI-Coachs als Karte (neuer Plan, Plan-Änderung mit Diff, Ziel, Wochenplan). Gespeichert wird nur über den Knopf - die KI ändert nie selbst etwas.
// Die Karte steht in voller Breite unter der Antwort (nicht in der 85-%-Blase) - sonst wird es für Tagesliste und Knopf zu eng.
import { computed, shallowRef, useId, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { categoryName, exerciseName, goalName } from '@/i18n/content';
import { formatDate, formatNumber } from '@/lib/format';
import { WEEKDAYS, bit } from '@/lib/schedule';
import { planConflict } from '@/lib/planned';
import { EVERY_DAY, daysBetween, parseDay } from '@/lib/routines';
import { prescriptionText, type PlannedExercise } from '@/lib/planned';
import { programDiff, type DayDiff, type DiffItem } from '@/lib/programDiff';
import { useAppStore } from '@/stores/app';
import { useAiStore, type AiAction } from '@/stores/ai';
import type { WorkoutOp } from '@/lib/liveWorkout';
import RoutineStepRow from './RoutineStepRow.vue';
import TeamIcon from './TeamIcon.vue';

const props = defineProps<{ action: AiAction; applied: boolean; busy: boolean }>();
const emit = defineEmits<{ apply: [] }>();
const { exercisesById, programs } = storeToRefs(useAppStore());
const titleId = useId();

const dayShort = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '');
const dayLong = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'long' });

const nameOf = (id: number) => { const ex = exercisesById.value.get(id); return ex ? exerciseName(ex) : `#${id}`; };
/** "4×5 @RPE 8" / "6×30 m" / "3×45 s" */
function dose(x: DiffItem) {
  const what = x.distance ? `${x.distance} ${t('units.m')}` : x.time ? `${x.time} ${t('units.s')}` : x.repsMin ? `${x.repsMin}${x.repsMax && x.repsMax !== x.repsMin ? `-${x.repsMax}` : ''}` : '';
  return `${x.sets}×${what}${x.targetRpe ? ` @RPE ${formatNumber(x.targetRpe, 1)}` : ''}`;
}
const prescription = (x: DiffItem) => `${nameOf(x.exerciseId)} ${dose(x)}`;

// Plan-Änderung: Vergleich mit dem Programm, wie es jetzt gespeichert ist
const liveDiff = computed(() => {
  if (props.action.type !== 'programUpdate') return [];
  const id = props.action.programId;
  return programDiff(programs.value.find((p) => p.id === id)?.days ?? [], props.action.program.days);
});
// Beim Übernehmen einfrieren - danach ist der gespeicherte Plan gleich dem Vorschlag und alles stünde auf "unverändert"
const frozenDiff = shallowRef<DayDiff[] | null>(null);
watch(() => props.busy, (b) => { if (b && !props.applied) frozenDiff.value = liveDiff.value; });
const diff = computed(() => frozenDiff.value ?? liveDiff.value);
// Nach Neuladen eines schon übernommenen Vorschlags gibt es keinen Vorher-Stand mehr: dann nur die Änderungsliste
const showDiff = computed(() => !props.applied || frozenDiff.value !== null);

const title = computed(() => {
  const a = props.action;
  if (a.type === 'routine' && a.replacesId) return t('ai.actions.routineUpdate');
  if (a.type === 'session') return a.session.status === 'skipped' ? t('ai.actions.sessionCancel') : a.replacesId ? t('ai.actions.sessionUpdate') : t('ai.actions.session');
  return t(`ai.actions.${a.type}`);
});
const button = computed(() => ({
  program: t('ai.actions.saveProgram'), programUpdate: t('ai.actions.applyUpdate'), goal: t('ai.actions.saveGoal'), schedule: t('ai.actions.applySchedule'),
  workout: t('ai.actions.applyWorkout'),
  routine: props.action.type === 'routine' && props.action.replacesId ? t('ai.actions.applyRoutine') : t('ai.actions.addRoutine'),
  session: props.action.type === 'session' && props.action.session.status === 'skipped' ? t('ai.actions.cancelSession')
    : props.action.type === 'session' && props.action.replacesId ? t('ai.actions.applySession') : t('ai.actions.addSession'),
})[props.action.type]);

// Routine: Tage, Zeitraum, Schritte
const routineDays = computed(() => {
  if (props.action.type !== 'routine') return '';
  const m = props.action.routine.days;
  return m === EVERY_DAY ? t('routines.everyDay') : WEEKDAYS.filter((d) => m & bit(d)).map(dayShort).join(' · ');
});
const routinePeriod = computed(() => {
  if (props.action.type !== 'routine') return '';
  const r = props.action.routine;
  const d = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
  if (!r.endDate) return t('routines.noEnd');
  const weeks = Math.round((daysBetween(r.startDate, r.endDate) + 1) / 7);
  return `${d(r.startDate)} – ${d(r.endDate)}${weeks >= 1 && (daysBetween(r.startDate, r.endDate) + 1) % 7 === 0 ? ` · ${tn('routines.sheet.durationWeeks', weeks)}` : ''}`;
});
// Geplante Einheit: Tag, Plan-Konflikt (falls der Wochenplan in derselben Antwort nicht verschoben wird)
const sessionDate = computed(() => (props.action.type === 'session'
  ? parseDay(props.action.session.date).toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }) : ''));
const sessionShort = computed(() => (props.action.type === 'session'
  ? parseDay(props.action.session.date).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) : ''));
/** Ersatz für den Plan-Tag oder zusätzlich an einem Trainingstag (Doppeltag); sonst nichts anzeigen. */
const sessionKind = computed(() => {
  const a = props.action;
  if (a.type !== 'session' || a.session.status === 'skipped') return null;
  if (a.session.replacesPlan) return 'replace';
  return planConflict(useAppStore().activeProgram, a.session.date) === 'training' ? 'double' : null;
});
function openInCalendar() {
  if (props.action.type !== 'session') return;
  useAiStore().open = false;
  useAppStore().openCalendarDay(props.action.session.date);
}
const sessionLine = (x: { exerciseId: number; exerciseName?: string } & PlannedExercise) => {
  const ex = useAppStore().exerciseFor(x.exerciseId);
  return { name: exerciseName(ex ?? x.exerciseId, x.exerciseName), text: prescriptionText(x, ex?.trackingType) };
};
const openInfo = (id: number) => useAppStore().openExerciseInfo(id, 'overlay');

// Änderung am laufenden Training: was genau, mit welchen Vorgaben
const opName = (id: number | undefined, fallback?: string) => (id == null ? fallback ?? '' : exercisesById.value.has(id) ? nameOf(id) : fallback ?? `#${id}`);
function opDose(o: WorkoutOp): string {
  if (o.op === 'remove') return '';
  const kg = o.weight != null ? `${formatNumber(o.weight, 2)} ${t('units.kg')}` : '';
  const what = o.trackingType === 'Cardio' || o.trackingType === 'Duration'
    ? (o.time ? (o.time >= 120 ? `${Math.round(o.time / 60)} ${t('units.min')}` : `${o.time} ${t('units.s')}`) : '')
    : o.trackingType === 'DistanceTime' ? (o.distance ? `${o.distance} ${t('units.m')}` : '')
    : [o.reps ? String(o.reps) : '', kg].filter(Boolean).join(' · ');
  const sets = o.sets ? (o.op === 'adjust' ? t('ai.actions.remaining', { sets: o.sets }) : `${o.sets}×`) : '';
  const rpe = o.targetRpe ? `@RPE ${formatNumber(o.targetRpe, 1)}` : '';
  return [sets, what, rpe].filter(Boolean).join(' ');
}
const OP_TONE: Record<WorkoutOp['op'], string> = {
  add: 'border-emerald-400/60 text-emerald-300', replace: 'border-accent/60 text-accent', remove: 'border-red-500/60 text-red-300', adjust: 'border-orange-400/60 text-orange-300',
};
const goalExercise = computed(() => {
  if (props.action.type !== 'goal') return '';
  const ex = exercisesById.value.get(props.action.exerciseId);
  return ex ? exerciseName(ex) : props.action.exerciseName;
});
const kind = (d: number) => {
  if (props.action.type !== 'schedule') return 'rest';
  return props.action.matchDays & bit(d) ? 'match' : props.action.trainingDays & bit(d) ? 'training' : 'rest';
};
/** Mannschaftstraining laut Vorschlag (ohne teamDays: wie bisher im aktiven Plan). */
const team = (d: number) => {
  if (props.action.type !== 'schedule' || props.action.matchDays & bit(d)) return false;
  return !!((props.action.teamDays ?? useAppStore().activeProgram?.teamDays ?? 0) & bit(d));
};
// Gleiche Optik wie der Wochenplan (WeekSchedule.vue) - Training, Spiel und Ruhe sehen überall gleich aus
const pill = (k: 'training' | 'match' | 'rest') => ({
  training: 'border-accent bg-accent text-on-accent',
  // /10 statt /15 wie im Wochenplan: auf der getönten Karte sonst < 4.5:1 für das 10-px-Kürzel in hellen Themes
  match: 'border-yellow-400 bg-yellow-400/10 text-yellow-300',
  rest: 'border-white/10 bg-white/[0.03] text-slate-400',
})[k];

// Nicht "disabled": ein deaktivierter Knopf verliert den Fokus - Tastatur/Screenreader stünden danach im Nichts
const locked = computed(() => props.applied || props.busy);
const apply = () => { if (!locked.value) emit('apply'); };
</script>

<template>
  <article class="ai-card rounded-2xl border border-accent/50 bg-accent/5 p-4" :aria-labelledby="titleId" :data-action="action.type">
      <h3 :id="titleId" class="text-tiny font-bold caps text-accent tracking-label">{{ title }}</h3>

      <template v-if="action.type === 'program'">
          <p class="mt-1 break-words text-lg font-bold leading-tight text-white">{{ action.program.name }}</p>
          <p class="mt-1 font-mono text-[11px] text-slate-400">{{ goalName(action.program.goal) }} · {{ t('builder.perWeek', { n: action.program.days.length }) }} · {{ tn('units.weeks', action.program.weeks) }}</p>
          <p v-if="action.summary" class="mt-2 text-sm leading-relaxed text-slate-200">{{ action.summary }}</p>
          <details class="group mt-1">
              <!-- Safari zeigt den Marker sonst trotz list-none -->
              <summary class="-mx-1 flex min-h-[2.75rem] cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-slate-300 hover:text-white [&::-webkit-details-marker]:hidden">
                  {{ tn('units.days', action.program.days.length) }}
                  <svg class="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
              </summary>
              <ol class="mb-1 space-y-2">
                  <li v-for="(d, i) in action.program.days" :key="i" class="rounded-xl border border-white/5 bg-black/20 p-3">
                      <p class="break-words text-xs font-bold caps text-slate-300 tracking-label">{{ d.name }}</p>
                      <ul class="mt-1.5 space-y-0.5"><li v-for="(x, j) in d.exercises" :key="j" class="break-words text-sm text-slate-200">{{ prescription(x) }}</li></ul>
                  </li>
              </ol>
          </details>
      </template>

      <template v-else-if="action.type === 'programUpdate'">
          <p class="mt-1 break-words text-lg font-bold leading-tight text-white">{{ action.programName }}<template v-if="action.program.name !== action.programName"> → {{ action.program.name }}</template></p>
          <ul v-if="action.changes.length" class="mt-2 space-y-1">
              <li v-for="(c, i) in action.changes" :key="i" class="flex gap-2 text-sm leading-snug text-slate-200"><span class="text-accent" aria-hidden="true">•</span><span class="min-w-0 break-words">{{ c }}</span></li>
          </ul>
          <details v-if="showDiff" class="group mt-1" open>
              <summary class="-mx-1 flex min-h-[2.75rem] cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-slate-300 hover:text-white [&::-webkit-details-marker]:hidden">
                  {{ t('ai.actions.details') }}
                  <svg class="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
              </summary>
              <ol class="mb-1 space-y-2" data-test="ai-diff">
                  <li v-for="(d, i) in diff" :key="i" class="rounded-xl border border-white/5 bg-black/20 p-3" :data-diff="d.status">
                      <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span class="break-words text-xs font-bold caps tracking-label" :class="d.status === 'removed' ? 'text-slate-400 line-through' : 'text-slate-200'">{{ d.name }}</span>
                          <span v-if="d.status !== 'same'" class="rounded-full px-2 py-0.5 text-tiny font-bold caps tracking-label"
                                :class="{ new: 'border border-emerald-400/60 text-emerald-300', changed: 'border border-orange-400/60 text-orange-300', removed: 'border border-red-500/60 text-red-300', same: '' }[d.status]">{{ t(`ai.actions.diff.${d.status}`) }}</span>
                          <span v-else class="text-tiny caps text-slate-400 tracking-label">{{ t('ai.actions.diff.same') }}</span>
                      </p>
                      <p v-if="d.renamedFrom" class="mt-1 text-[11px] text-slate-400">{{ t('ai.actions.diff.renamed', { name: d.renamedFrom }) }}</p>
                      <ul v-if="d.status !== 'same'" class="mt-1.5 space-y-1 text-sm">
                          <li v-for="(x, j) in d.added" :key="`a${j}`" class="flex gap-2 text-slate-200"><span class="font-bold text-emerald-300" aria-hidden="true">+</span><span class="sr-only">{{ t('ai.actions.diff.addedSr') }}</span><span class="min-w-0 break-words">{{ prescription(x) }}</span></li>
                          <li v-for="(x, j) in d.changed" :key="`c${j}`" class="flex gap-2 text-slate-200"><span class="font-bold text-orange-300" aria-hidden="true">~</span><span class="sr-only">{{ t('ai.actions.diff.changedSr') }}</span><span class="min-w-0 break-words">{{ nameOf(x.to.exerciseId) }}: <span class="text-slate-400 line-through">{{ dose(x.from) }}</span> → {{ dose(x.to) }}</span></li>
                          <li v-for="(x, j) in d.removed" :key="`r${j}`" class="flex gap-2 text-slate-200"><span class="font-bold text-red-300" aria-hidden="true">−</span><span class="sr-only">{{ t('ai.actions.diff.removedSr') }}</span><span class="min-w-0 break-words text-slate-400 line-through">{{ prescription(x) }}</span></li>
                      </ul>
                  </li>
              </ol>
          </details>
      </template>

      <template v-else-if="action.type === 'workout'">
          <ul v-if="action.changes.length" class="mt-1.5 space-y-1">
              <li v-for="(c, i) in action.changes" :key="i" class="flex gap-2 text-sm leading-snug text-slate-200"><span class="text-accent" aria-hidden="true">•</span><span class="min-w-0 break-words">{{ c }}</span></li>
          </ul>
          <ol class="mt-2 space-y-1.5" data-test="ai-workout-ops">
              <li v-for="(o, i) in action.operations" :key="i" class="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5" :data-op="o.op">
                  <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span class="rounded-full border px-2 py-0.5 text-tiny font-bold caps tracking-label" :class="OP_TONE[o.op]">{{ t(`ai.actions.ops.${o.op}`) }}</span>
                      <span class="min-w-0 break-words text-sm font-bold" :class="o.op === 'remove' ? 'text-slate-400 line-through' : o.op === 'replace' ? 'text-slate-400' : 'text-white'">{{ opName(o.exerciseId, o.name) }}</span>
                      <template v-if="o.op === 'replace'"><span class="text-slate-400" aria-hidden="true">→</span><span class="min-w-0 break-words text-sm font-bold text-white">{{ opName(o.withExerciseId, o.withName) }}</span></template>
                  </p>
                  <p v-if="opDose(o)" class="mt-1 font-mono text-[11px] text-slate-300">{{ opDose(o) }}</p>
                  <p v-if="o.note" class="mt-0.5 text-[11px] leading-snug text-slate-400">{{ o.note }}</p>
              </li>
          </ol>
      </template>

      <template v-else-if="action.type === 'session'">
          <p class="mt-1 break-words text-lg font-bold leading-tight text-white">{{ action.session.title }}</p>
          <p class="mt-1 font-mono text-[11px] text-slate-400">{{ sessionDate }} · {{ categoryName(action.session.category) }}</p>
          <!-- Was der Termin für den Plan bedeutet: Ersatz (kein Doppeltag) oder zusätzlich am Trainingstag -->
          <p v-if="sessionKind" class="mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold leading-tight" data-test="ai-session-kind"
             :class="sessionKind === 'replace' ? 'bg-accent/15 text-accent' : 'bg-amber-400/10 text-amber-300'">
              {{ sessionKind === 'replace' ? (action.session.planDayName ? t('ai.actions.replacesDay', { day: action.session.planDayName }) : t('planned.replacedBadge')) : t('ai.actions.doubleDay') }}
          </p>
          <ol v-if="action.session.status !== 'skipped'" class="mt-2 space-y-1.5" data-test="ai-session-exercises">
              <RoutineStepRow v-for="(x, i) in action.session.exercises" :key="i" :index="i" boxed :name="sessionLine(x).name" :dose="sessionLine(x).text" :exercise-id="x.exerciseId" @info="openInfo" />
          </ol>
          <p v-if="action.session.notes" class="mt-2 text-xs leading-relaxed text-slate-400">{{ action.session.notes }}</p>
          <p v-if="action.session.reason" class="mt-2 text-sm leading-relaxed text-slate-300">{{ action.session.reason }}</p>
      </template>

      <template v-else-if="action.type === 'routine'">
          <p class="mt-1 break-words text-lg font-bold leading-tight text-white">{{ action.routine.title }}</p>
          <p class="mt-1 font-mono text-[11px] text-slate-400">
              <span class="routine-kind" :data-kind="action.routine.kind">{{ t(`routines.kinds.${action.routine.kind}`) }}</span> · {{ routineDays }}<template v-if="(action.routine.timesPerDay ?? 1) > 1"> · {{ tn('routines.timesPerDay', action.routine.timesPerDay) }}</template><template v-if="action.routine.times?.length"> · {{ action.routine.times.join(', ') }}</template> · {{ routinePeriod }}
          </p>
          <ol class="mt-2 space-y-1.5" data-test="ai-routine-steps">
              <RoutineStepRow v-for="(s, i) in action.routine.steps" :key="i" :index="i" boxed :name="s.name" :dose="s.dose" :exercise-id="s.exerciseId" @info="openInfo" />
          </ol>
          <p v-if="action.routine.reason" class="mt-2 text-sm leading-relaxed text-slate-300">{{ action.routine.reason }}</p>
      </template>

      <template v-else-if="action.type === 'goal'">
          <p class="mt-1 break-words font-bold leading-tight text-white">{{ goalExercise }}</p>
          <!-- Die Zielzahl ist das Wichtigste auf der Karte - also das Größte -->
          <p class="mt-1 font-mono text-3xl font-black leading-none text-white">{{ formatNumber(action.targetWeight, 2) }}<span class="ml-1 text-sm font-bold text-slate-400">{{ t('units.kg') }}</span> × {{ action.targetReps }}</p>
          <p v-if="action.targetDate" class="mt-1.5 font-mono text-[11px] text-slate-400">{{ t('ai.actions.by', { date: formatDate(action.targetDate, { day: 'numeric', month: 'short', year: 'numeric' }) }) }}</p>
          <p v-if="action.reason" class="mt-2 text-sm leading-relaxed text-slate-300">{{ action.reason }}</p>
      </template>

      <template v-else-if="action.type === 'schedule'">
          <ul class="mt-2 grid grid-cols-7 gap-1">
              <li v-for="d in WEEKDAYS" :key="d" class="flex flex-col items-center rounded-lg border py-1.5" :class="pill(kind(d))">
                  <span class="sr-only">{{ dayLong(d) }}: {{ t(`schedule.kind.${kind(d)}`) }}<template v-if="team(d)">, {{ t('schedule.kind.team') }}</template></span>
                  <span class="text-tiny font-bold caps tracking-label" aria-hidden="true">{{ dayShort(d) }}</span>
                  <!-- Symbol statt nur Farbe (Spieltag/Training auch ohne Farbsehen erkennbar) -->
                  <span class="mt-0.5 flex h-3.5 items-center" aria-hidden="true">
                      <svg v-if="kind(d) === 'training'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
                      <svg v-else-if="kind(d) === 'match'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7z" fill="currentColor"/></svg>
                      <span v-else class="h-1 w-1 rounded-full bg-current opacity-60"></span>
                  </span>
                  <TeamIcon v-if="team(d)" class="mt-0.5 h-3 w-3" data-test="schedule-card-team" />
              </li>
          </ul>
          <p v-if="action.reason" class="mt-2 text-sm leading-relaxed text-slate-300">{{ action.reason }}</p>
      </template>

      <button type="button" @click="apply" :aria-disabled="locked" :aria-busy="busy"
              class="mt-3 flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold leading-tight"
              :class="applied ? 'cursor-default border border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : ['btn-primary', busy ? 'cursor-wait' : '']" data-test="ai-action-apply">
          <span v-if="busy" class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
          <template v-if="applied"><span aria-hidden="true">✓</span> {{ action.type === 'session' && action.session.status !== 'skipped' ? t('ai.actions.inCalendar', { date: sessionShort }) : t('ai.actions.saved') }}</template>
          <template v-else>{{ button }}</template>
      </button>
      <!-- Nach dem Übernehmen: direkt sehen, wo es gelandet ist -->
      <button v-if="applied && action.type === 'session' && action.session.status !== 'skipped'" type="button" class="routine-link mt-2" data-test="ai-session-open"
              @click="openInCalendar">{{ t('ai.actions.showInCalendar') }} ›</button>
  </article>
</template>
