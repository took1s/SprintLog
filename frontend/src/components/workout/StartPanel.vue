<script setup lang="ts">
// Einstieg, wenn keine Einheit läuft: leer starten, letzte wiederholen oder nächsten Plan-Tag.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { dayName, exerciseName, programName } from '@/i18n/content';
import { useAppStore, MATCH } from '@/stores/app';
import { formatRelative } from '@/lib/format';
import CoachCard from './CoachCard.vue';
import RecoveryCard from '@/components/RecoveryCard.vue';

const app = useAppStore();
const { activeProgram, allWorkouts, clockDate, coach, exercisesById, programInfo, startLine, tab } = storeToRefs(app);
const { repeatWorkout, startProgramDay, startWorkout } = app;

const isField = computed(() => tab.value === 'Football');
/** Server-Sätze tragen keine Kategorie - sie kommt aus dem Katalog. */
const categoryOf = (s: { exerciseId?: number | null; category?: string }) => (s.exerciseId != null ? exercisesById.value.get(s.exerciseId)?.category : undefined) ?? s.category ?? 'Gym';

/** Letzte Einheit dieses Bereichs (Gym bzw. Feld), keine Spiele. */
const lastWorkout = computed(() => allWorkouts.value
  .filter((w) => w.workoutType !== MATCH && (w.sets ?? []).some((s) => categoryOf(s) === (isField.value ? 'Football' : 'Gym')))
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null);

const lastSummary = computed(() => {
  const w = lastWorkout.value;
  if (!w) return '';
  const names = [...new Set((w.sets ?? []).map((s) => exerciseName(s.exerciseId ?? null, s.exerciseName ?? s.name)))];
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
});
const lastCount = computed(() => new Set((lastWorkout.value?.sets ?? []).map((s) => s.exerciseId ?? s.exerciseName)).size);
</script>

<template>
  <section class="glass-panel mb-6 rounded-3xl p-5" data-test="start-panel">
      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ isField ? t('start.kickerField') : t('start.kicker') }}</p>
      <h2 class="display mt-1 text-3xl text-white">{{ isField ? t('start.titleField') : t('start.title') }}</h2>
      <p v-if="startLine" class="mt-2 text-sm leading-snug text-slate-300" data-test="start-line">{{ startLine }}</p>

      <CoachCard />

      <button type="button" @click="startWorkout" data-test="start-empty" class="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base">
          <span class="text-xl leading-none">+</span> {{ t('start.empty') }}
      </button>

      <div class="mt-3 grid grid-cols-1 gap-2" :class="activeProgram && programInfo?.next && lastWorkout ? 'sm:grid-cols-2' : ''">
          <button v-if="activeProgram && programInfo?.next" type="button" @click="programInfo?.next && startProgramDay(programInfo.next)" data-test="start-plan"
                  class="btn-secondary min-w-0 rounded-2xl p-4 text-left">
              <span class="block text-[10px] font-bold uppercase tracking-label">{{ t('start.nextPlanDay') }}</span>
              <span class="mt-1 block truncate text-base font-bold text-white">{{ dayName(activeProgram, programInfo.next) }}</span>
              <span class="block truncate font-mono text-[11px] text-slate-400">{{ programName(activeProgram) }} · {{ tn('units.exercises', programInfo.next.exercises.length) }}</span>
              <span v-if="coach.kind === 'light'" class="mt-1 block text-[11px] font-bold text-orange-300">{{ t('coach.kinds.light.title') }}</span>
              <span v-else-if="coach.kind === 'rest'" class="mt-1 block text-[11px] font-bold text-slate-400" data-test="plan-rest-hint">{{ t('coach.kinds.rest.title') }}</span>
          </button>
          <button v-if="lastWorkout" type="button" @click="repeatWorkout(lastWorkout)" data-test="start-repeat"
                  class="btn-ghost min-w-0 rounded-2xl p-4 text-left">
              <span class="block text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('start.repeat') }} · {{ formatRelative(lastWorkout.date, clockDate) }}</span>
              <span class="mt-1 block truncate text-base font-bold text-white">{{ lastSummary }}</span>
              <span class="block font-mono text-[11px] text-slate-400">{{ tn('units.exercises', lastCount) }} · {{ tn('units.sets', lastWorkout.sets?.length ?? 0) }}</span>
          </button>
      </div>

      <RecoveryCard />
  </section>
</template>
