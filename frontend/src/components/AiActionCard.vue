<script setup lang="ts">
// Vorschlag des KI-Coachs als Karte (neuer Plan, Plan-Änderung mit Diff, Ziel, Wochenplan). Gespeichert wird nur über den Knopf - die KI ändert nie selbst etwas.
// Die Karte steht in voller Breite unter der Antwort (nicht in der 85-%-Blase) - sonst wird es für Tagesliste und Knopf zu eng.
import { computed, shallowRef, useId, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { exerciseName, goalName } from '@/i18n/content';
import { formatDate, formatNumber } from '@/lib/format';
import { WEEKDAYS, bit } from '@/lib/schedule';
import { programDiff, type DayDiff, type DiffItem } from '@/lib/programDiff';
import { useAppStore } from '@/stores/app';
import type { AiAction } from '@/stores/ai';

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

const title = computed(() => t(`ai.actions.${props.action.type}`));
const button = computed(() => ({
  program: t('ai.actions.saveProgram'), programUpdate: t('ai.actions.applyUpdate'), goal: t('ai.actions.saveGoal'), schedule: t('ai.actions.applySchedule'),
})[props.action.type]);
const goalExercise = computed(() => {
  if (props.action.type !== 'goal') return '';
  const ex = exercisesById.value.get(props.action.exerciseId);
  return ex ? exerciseName(ex) : props.action.exerciseName;
});
const kind = (d: number) => {
  if (props.action.type !== 'schedule') return 'rest';
  return props.action.matchDays & bit(d) ? 'match' : props.action.trainingDays & bit(d) ? 'training' : 'rest';
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
  <article class="rounded-2xl border border-accent/50 bg-accent/5 p-4" :aria-labelledby="titleId" :data-action="action.type">
      <h3 :id="titleId" class="text-[10px] font-bold uppercase text-accent tracking-label">{{ title }}</h3>

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
                      <p class="break-words text-xs font-bold uppercase text-slate-300 tracking-label">{{ d.name }}</p>
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
                          <span class="break-words text-xs font-bold uppercase tracking-label" :class="d.status === 'removed' ? 'text-slate-400 line-through' : 'text-slate-200'">{{ d.name }}</span>
                          <span v-if="d.status !== 'same'" class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-label"
                                :class="{ new: 'border border-emerald-400/60 text-emerald-300', changed: 'border border-orange-400/60 text-orange-300', removed: 'border border-red-500/60 text-red-300', same: '' }[d.status]">{{ t(`ai.actions.diff.${d.status}`) }}</span>
                          <span v-else class="text-[10px] uppercase text-slate-400 tracking-label">{{ t('ai.actions.diff.same') }}</span>
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
                  <span class="sr-only">{{ dayLong(d) }}: {{ t(`schedule.kind.${kind(d)}`) }}</span>
                  <span class="text-[10px] font-bold uppercase tracking-label" aria-hidden="true">{{ dayShort(d) }}</span>
                  <!-- Symbol statt nur Farbe (Spieltag/Training auch ohne Farbsehen erkennbar) -->
                  <span class="mt-0.5 flex h-3.5 items-center" aria-hidden="true">
                      <svg v-if="kind(d) === 'training'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></svg>
                      <svg v-else-if="kind(d) === 'match'" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l3.2 2.3-1.2 3.7h-4l-1.2-3.7z" fill="currentColor"/></svg>
                      <span v-else class="h-1 w-1 rounded-full bg-current opacity-60"></span>
                  </span>
              </li>
          </ul>
          <p v-if="action.reason" class="mt-2 text-sm leading-relaxed text-slate-300">{{ action.reason }}</p>
      </template>

      <button type="button" @click="apply" :aria-disabled="locked" :aria-busy="busy"
              class="mt-3 flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold leading-tight"
              :class="applied ? 'cursor-default border border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : ['btn-primary', busy ? 'cursor-wait' : '']" data-test="ai-action-apply">
          <span v-if="busy" class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
          <template v-if="applied"><span aria-hidden="true">✓</span> {{ t('ai.actions.saved') }}</template>
          <template v-else>{{ button }}</template>
      </button>
  </article>
</template>
