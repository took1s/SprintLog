<script setup lang="ts">
// Главная карточка дня: дата и фаза матча (MD), вердикт тренера (тренироваться / легко / отдых / матч / реабилитация)
// с причинами по запросу, одна главная кнопка (день плана или пустая тренировка) и вторичные действия рядом.
// Объединяет прежние "Тренер" и блок кнопок старта - ничего не удалено, только порядок и вес.
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { dayName, exerciseName, programName } from '@/i18n/content';
import { useAppStore, MATCH } from '@/stores/app';
import { useAiStore } from '@/stores/ai';
import { formatRelative } from '@/lib/format';
import { mdInfo } from '@/lib/matchDay';
import { localDay } from '@/lib/wellness';
import type { Reason, TodayKind } from '@/lib/coach';

const app = useAppStore();
const ai = useAiStore();
const { activeProgram, allWorkouts, clockDate, coach, exercisesById, programInfo, startLine, tab } = storeToRefs(app);
const { openPlanBuilder, repeatWorkout, startProgramDay, startWorkout } = app;
onMounted(() => { if (!ai.status) void ai.loadStatus(); });

const isField = computed(() => tab.value === 'Football');
const today = computed(() => localDay(clockDate.value));
const md = computed(() => mdInfo(today.value, activeProgram.value));
const dateLabel = computed(() => clockDate.value.toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }));
const shortDate = computed(() => clockDate.value.toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' }));

const tone: Record<TodayKind, string> = { train: 'is-train', light: 'is-light', rest: 'is-rest', match: 'is-match', rehab: 'is-rehab' };
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
const next = computed(() => (activeProgram.value && programInfo.value?.next ? programInfo.value.next : null));
const mdAdjust = computed(() => (md.value && md.value.label !== 'MD' && md.value.volume < 1 ? Math.round((1 - md.value.volume) * 100) : 0));
</script>

<template>
  <section class="today-hero" :class="tone[coach.kind]" :data-coach="coach.kind" data-test="coach-card" aria-labelledby="today-title">
      <div class="flex items-center gap-2">
          <span class="today-dot" aria-hidden="true"></span>
          <span class="min-w-0 truncate text-[10px] font-bold uppercase tracking-label text-slate-300" data-test="today-date">{{ md ? shortDate : dateLabel }}</span>
          <span v-if="md" class="md-chip flex-shrink-0" :class="`is-${md.load}`" data-test="today-md">{{ md.label }}<span class="hidden min-[380px]:inline"> · {{ t(`md.focus.${md.focus}`) }}</span></span>
          <button v-if="ai.enabled" type="button" class="today-ask ml-auto" :aria-label="t('ai.open')" data-test="coach-ask" @click="ai.openChat()">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9L19 15z"/></svg>
          </button>
      </div>

      <h2 id="today-title" class="today-title display mt-2 break-words text-[1.75rem] leading-[1.05]">{{ t(`coach.kinds.${coach.kind}.title`) }}</h2>
      <p class="mt-1.5 text-sm leading-snug text-slate-200">
          {{ t(`coach.kinds.${coach.kind}.text`) }}
      </p>
      <p v-if="startLine" class="mt-1 text-xs leading-snug text-slate-400" data-test="start-line">{{ startLine }}</p>

      <button v-if="reasons.length" type="button" class="mt-1 inline-flex min-h-[2.25rem] items-center text-[11px] font-bold text-slate-400 hover:text-white" :aria-expanded="showWhy" data-test="coach-why" @click="showWhy = !showWhy">
          {{ t('coach.why') }} {{ showWhy ? '▴' : '▾' }}
      </button>
      <transition name="expand">
          <div v-if="showWhy" class="expand-wrap">
              <ul class="flex flex-wrap gap-1.5 pt-2" :aria-label="t('coach.why')">
                  <li v-for="r in reasons" :key="r" class="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] leading-tight text-slate-300">{{ r }}</li>
              </ul>
          </div>
      </transition>

      <!-- Главное действие -->
      <button v-if="next" type="button" class="today-cta mt-4" data-test="start-plan" @click="startProgramDay(next)">
          <span class="min-w-0 flex-1 text-left">
              <span class="block text-[10px] font-bold uppercase tracking-label opacity-80">{{ t('start.nextPlanDay') }}</span>
              <span class="block truncate text-lg font-black leading-tight">{{ dayName(activeProgram, next) }}</span>
              <span class="block truncate text-[11px] font-semibold opacity-80">
                  {{ activeProgram ? programName(activeProgram) : '' }} · {{ tn('units.exercises', next.exercises.length) }}<template v-if="mdAdjust"> · {{ t('md.lighter', { label: md!.label, pct: mdAdjust }) }}</template>
              </span>
              <span v-if="coach.kind === 'light'" class="mt-0.5 block text-[11px] font-bold">{{ t('coach.kinds.light.title') }}</span>
              <span v-else-if="coach.kind === 'rest'" class="mt-0.5 block text-[11px] font-bold" data-test="plan-rest-hint">{{ t('coach.kinds.rest.title') }}</span>
          </span>
          <svg class="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>
      </button>
      <button v-else type="button" class="today-cta mt-4 justify-center" data-test="start-empty" @click="startWorkout">
          <span class="text-xl leading-none">+</span> <span class="text-base font-black">{{ t('start.empty') }}</span>
      </button>

      <!-- Вторичные действия -->
      <div class="mt-2 grid gap-2" :class="next && lastWorkout ? 'grid-cols-2' : 'grid-cols-1'">
          <button v-if="next" type="button" class="today-secondary" data-test="start-empty" @click="startWorkout">
              <span class="text-base leading-none">+</span> {{ t('start.emptyShort') }}
          </button>
          <button v-if="lastWorkout" type="button" class="today-secondary min-w-0" data-test="start-repeat" :title="lastSummary" @click="repeatWorkout(lastWorkout)">
              <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 0113.7-5.7L20 8.6M20 4v4.6h-4.6M20 12a8 8 0 01-13.7 5.7L4 15.4M4 20v-4.6h4.6"/></svg>
              <span class="min-w-0 truncate">{{ t('start.repeatShort') }} · {{ formatRelative(lastWorkout.date, clockDate) }}</span>
          </button>
      </div>
      <button v-if="!activeProgram" type="button" class="mt-3 w-full rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5" data-test="coach-build" @click="openPlanBuilder()">
          <span class="font-bold text-white">{{ t('coach.buildPlan') }}</span> · {{ t('coach.noPlanShort') }}
      </button>
  </section>
</template>
