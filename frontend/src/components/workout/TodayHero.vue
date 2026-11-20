<script setup lang="ts">
// Главная карточка дня: дата и фаза матча (MD), вердикт тренера (тренироваться / легко / отдых / матч / реабилитация)
// с причинами по запросу, одна главная кнопка (день плана или пустая тренировка) и вторичные действия рядом.
// Объединяет прежние "Тренер" и блок кнопок старта - ничего не удалено, только порядок и вес.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { dayName, exerciseName } from '@/i18n/content';
import { useAppStore, MATCH } from '@/stores/app';
import { usePlannedStore } from '@/stores/planned';
import { formatRelative } from '@/lib/format';
import { mdInfo } from '@/lib/matchDay';
import { localDay } from '@/lib/wellness';
import type { Reason, TodayKind } from '@/lib/coach';

const app = useAppStore();
const { activeProgram, allWorkouts, clockDate, coach, exercisesById, nextPlanKicker, programInfo, startLine, tab } = storeToRefs(app);
const { openPlanBuilder, repeatWorkout, startProgramDay, startWorkout } = app;

const isField = computed(() => tab.value === 'Football');
const today = computed(() => localDay(clockDate.value));
const md = computed(() => mdInfo(today.value, activeProgram.value));
const dateLabel = computed(() => clockDate.value.toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }));

const tone: Record<TodayKind, string> = { train: 'is-train', light: 'is-light', rest: 'is-rest', match: 'is-match', rehab: 'is-rehab', team: 'is-team' };
function reasonText(r: Reason): string {
  switch (r.key) {
    case 'readinessLow':
    case 'readinessGood': return t(`coach.reasons.${r.key}`, { value: r.value });
    case 'notRecovered': return t('coach.reasons.notRecovered', { region: t(`recovery.regions.${r.region}`), percent: r.percent });
    case 'longBreak': return t('coach.reasons.longBreak', { days: r.days });
    case 'planNext': return t('coach.reasons.planNext', { day: r.day });
    default: return t(`coach.reasons.${r.key}`);
  }
}
const reasons = computed(() => coach.value.reasons.map(reasonText));
const showWhy = ref(false);

/** Server-Sätze tragen keine Kategorie - sie kommt aus dem Katalog. */
const categoryOf = (s: { exerciseId?: number | null; category?: string }) => (s.exerciseId != null ? exercisesById.value.get(s.exerciseId)?.category : undefined) ?? s.category ?? 'Gym';
const lastWorkout = computed(() => allWorkouts.value
  .filter((w) => w.workoutType !== MATCH && (w.sets ?? []).some((s) => categoryOf(s) === (isField.value ? 'Football' : 'Gym')))
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null);
const lastSummary = computed(() => {
  const w = lastWorkout.value;
  if (!w) return '';
  const names = [...new Set((w.sets ?? []).map((s) => exerciseName(s.exerciseId ?? null, s.exerciseName ?? s.name)))];
  return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
});
const planned = usePlannedStore();
/** Heute ersetzt eine Einheit (meist vom Coach) den Plan-Tag: sie ist der Haupt-Knopf, der Plan-Tag rückt weiter. */
const replacement = computed(() => (planned.replacementToday?.status === 'planned' ? planned.replacementToday : null));
const replacedDay = computed(() => (replacement.value && activeProgram.value ? programInfo.value?.todayDay ?? null : null));
const next = computed(() => (!replacement.value && activeProgram.value && programInfo.value?.next ? programInfo.value.next : null));
const mdAdjust = computed(() => (md.value && md.value.label !== 'MD' && md.value.volume < 1 ? Math.round((1 - md.value.volume) * 100) : 0));
/**
 * Der Plan-Tag ist nur dann der grüne Haupt-Knopf, wenn er heute dran ist und der Coach heute Training sieht.
 * Ruhetag, Spieltag oder Mannschaftstraining: er steht ruhig als "Als Nächstes" da - sonst schreit die Karte
 * "Trainieren!", während der Titel "Ruhetag" sagt.
 */
const nextIsToday = computed(() => {
  const info = programInfo.value;
  return !!next.value && (info?.nextBy !== 'weekday' || !info?.nextDate || localDay(info.nextDate) <= today.value);
});
const nextPrimary = computed(() => nextIsToday.value && ['train', 'light', 'rehab'].includes(coach.value.kind));
/** Motivationszeile nur, wenn sie nicht dasselbe sagt wie der Titel (Ruhe-/Spiel-/Reha-Tag haben dort schon ihren Satz). */
const line = computed(() => (['rest', 'match', 'rehab'].includes(coach.value.kind) ? '' : startLine.value));
const showFocus = computed(() => !!md.value && md.value.label !== 'MD' && ['train', 'light'].includes(coach.value.kind));
</script>

<template>
  <section class="today-hero" :class="tone[coach.kind]" :data-coach="coach.kind" data-test="coach-card" aria-labelledby="today-title">
      <div class="flex min-h-[1.5rem] items-center gap-2">
          <span class="today-dot" aria-hidden="true"></span>
          <span class="today-date min-w-0 truncate" data-test="today-date">{{ dateLabel }}</span>
          <span v-if="md" class="md-chip ml-auto flex-shrink-0" :class="`is-${md.load}`" :title="t(`md.focus.${md.focus}`)" data-test="today-md">{{ md.label }}<template v-if="showFocus"> · {{ t(`md.focus.${md.focus}`) }}</template></span>
      </div>

      <h2 id="today-title" class="today-title display mt-2 break-words">{{ t(`coach.kinds.${coach.kind}.title`) }}</h2>
      <p class="today-text mt-1">{{ t(`coach.kinds.${coach.kind}.text`) }}</p>
      <p v-if="line" class="mt-1 text-[13px] leading-snug text-slate-400" data-test="start-line">{{ line }}</p>

      <button v-if="reasons.length" type="button" class="mt-1 inline-flex min-h-[2.25rem] items-center gap-1 text-[13px] font-semibold text-slate-400 hover:text-white" :aria-expanded="showWhy" data-test="coach-why" @click="showWhy = !showWhy">
          {{ t('coach.why') }}
          <svg class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-180': showWhy }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
      </button>
      <transition name="expand">
          <div v-if="showWhy" class="expand-wrap">
              <ul class="flex flex-wrap gap-1.5 pt-1" :aria-label="t('coach.why')">
                  <li v-for="r in reasons" :key="r" class="rounded-full bg-white/5 px-2.5 py-1 text-xs leading-tight text-slate-300">{{ r }}</li>
              </ul>
          </div>
      </transition>

      <!-- Hauptaktion: Ersatz-Einheit > Plan-Tag (wenn heute dran) > leere Einheit -->
      <template v-if="replacement">
          <button type="button" class="today-cta mt-4" data-test="start-replacement" @click="planned.start(replacement.clientId)">
              <span class="min-w-0 flex-1 text-left">
                  <span class="today-cta-kicker">{{ t('planned.replaceKicker') }}<template v-if="replacement.source === 'coach'"> · {{ t('planned.byCoach') }}</template></span>
                  <span class="today-cta-title">{{ replacement.title }}</span>
                  <span class="today-cta-meta">
                      {{ tn('units.exercises', replacement.exercises.length) }}<template v-if="replacedDay"> · {{ t('planned.insteadOf', { day: dayName(activeProgram, replacedDay) }) }}</template>
                  </span>
              </span>
              <svg class="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>
          </button>
          <button type="button" class="mt-1 inline-flex min-h-[2.25rem] items-center text-[13px] font-semibold text-slate-400 hover:text-white" data-test="replacement-undo" @click="planned.restorePlanDay(replacement.clientId)">
              ↺ {{ t('planned.backToPlan') }}
          </button>
      </template>
      <button v-else-if="next" type="button" class="mt-4" :class="nextPrimary ? 'today-cta' : 'today-next'" data-test="start-plan" @click="startProgramDay(next)">
          <span class="min-w-0 flex-1 text-left">
              <span class="today-cta-kicker" data-test="plan-kicker">{{ nextPlanKicker }}</span>
              <span class="today-cta-title">{{ dayName(activeProgram, next) }}</span>
              <span class="today-cta-meta">
                  {{ tn('units.exercises', next.exercises.length) }}<template v-if="mdAdjust && nextPrimary"> · {{ t('md.lighter', { label: md!.label, pct: mdAdjust }) }}</template>
              </span>
              <span v-if="nextPrimary && coach.kind === 'light'" class="mt-0.5 block text-xs font-bold">{{ t('coach.kinds.light.title') }}</span>
          </span>
          <svg v-if="nextPrimary" class="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>
          <svg v-else class="h-5 w-5 flex-shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
      </button>
      <button v-else type="button" class="today-cta mt-4 justify-center" data-test="start-empty" @click="startWorkout">
          <span class="text-xl leading-none">+</span> <span class="text-base font-bold">{{ t('start.empty') }}</span>
      </button>

      <!-- Weitere Wege in eine Einheit -->
      <div class="mt-2 grid gap-2" :class="(next || replacement) && lastWorkout ? 'grid-cols-2' : 'grid-cols-1'">
          <button v-if="next || replacement" type="button" class="today-secondary" data-test="start-empty" @click="startWorkout">
              <span class="text-base leading-none">+</span> {{ t('start.emptyShort') }}
          </button>
          <button v-if="lastWorkout" type="button" class="today-secondary min-w-0" data-test="start-repeat" :title="lastSummary" @click="repeatWorkout(lastWorkout)">
              <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 0113.7-5.7L20 8.6M20 4v4.6h-4.6M20 12a8 8 0 01-13.7 5.7L4 15.4M4 20v-4.6h4.6"/></svg>
              <span class="flex min-w-0 flex-col items-start leading-tight">
                  <span>{{ t('start.repeatShort') }}</span>
                  <span class="max-w-full truncate text-[11px] font-medium text-slate-500">{{ formatRelative(lastWorkout.date, clockDate) }}</span>
              </span>
          </button>
      </div>
      <button v-if="!activeProgram" type="button" class="mt-3 w-full rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-left text-[13px] text-slate-300 hover:bg-white/5" data-test="coach-build" @click="openPlanBuilder()">
          <span class="font-bold text-white">{{ t('coach.buildPlan') }}</span> · {{ t('coach.noPlanShort') }}
      </button>
  </section>
</template>
