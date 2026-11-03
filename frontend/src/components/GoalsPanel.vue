<script setup lang="ts">
// Kraft-Ziele im Plan-Tab: Fortschritt, Vorgabe für die nächste Einheit, Prognose.
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { useGoalsStore } from '@/stores/goals';
import { e1rmLabel, etaLabel, goalTargetLabel, paceLabel, prescriptionLabel } from '@/lib/goalText';

const app = useAppStore();
const goals = useGoalsStore();
const { views } = storeToRefs(goals);
const { exerciseFor } = app;
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="goals-panel">
      <div class="mb-4 flex items-center justify-between gap-3">
          <div>
              <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('goals.kicker') }}</p>
              <h2 class="display text-2xl text-white">{{ t('goals.title') }}</h2>
          </div>
          <button type="button" @click="goals.openNewGoal()" class="btn-secondary flex-shrink-0 rounded-xl px-4 py-2.5 text-xs" data-test="goal-new">+ {{ t('goals.add') }}</button>
      </div>

      <p v-if="!views.length" class="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm leading-relaxed text-slate-400">{{ t('goals.empty') }}</p>

      <ul v-else class="space-y-3">
          <li v-for="v in views" :key="v.goal.exerciseId">
              <button type="button" @click="goals.openGoal(v.goal.exerciseId)" class="w-full rounded-2xl border p-4 text-left transition-colors hover:bg-white/5"
                      :class="v.progress.achieved ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-white/10 bg-white/[0.03]'" :data-goal="v.goal.exerciseId">
                  <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                          <div class="truncate font-bold text-white">{{ exerciseName(v.exercise ?? exerciseFor(v.goal.exerciseId)) }}</div>
                          <div class="font-mono text-[11px] text-slate-400">{{ goalTargetLabel(v.goal) }}<template v-if="v.goal.pending"> · {{ t('goals.pendingSync') }}</template></div>
                      </div>
                      <div class="display flex-shrink-0 text-2xl leading-none" :class="v.progress.achieved ? 'text-yellow-400' : 'text-accent'">{{ v.progress.percent }}%</div>
                  </div>
                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="v.progress.percent" aria-valuemin="0" aria-valuemax="100">
                      <div class="h-full rounded-full transition-all" :class="v.progress.achieved ? 'bg-yellow-400' : 'bg-accent'" :style="{ width: Math.max(3, v.progress.percent) + '%' }"></div>
                  </div>
                  <div class="mt-3 flex items-center justify-between gap-2">
                      <span class="min-w-0 truncate font-mono text-xs font-bold text-white">{{ prescriptionLabel(v.next, v.goal) }}</span>
                      <span v-if="v.progress.onTrack != null && !v.progress.achieved" class="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-label"
                            :class="v.progress.onTrack ? 'bg-emerald-400/15 text-emerald-400' : 'bg-orange-400/15 text-orange-300'">{{ v.progress.onTrack ? t('goals.onTrack') : t('goals.behind') }}</span>
                  </div>
                  <div class="mt-1 font-mono text-[11px] leading-relaxed text-slate-500">
                      <template v-if="e1rmLabel(v.progress)">{{ e1rmLabel(v.progress) }} · </template>{{ etaLabel(v.progress) }}<template v-if="paceLabel(v.progress)"> · {{ paceLabel(v.progress) }}</template>
                  </div>
              </button>
          </li>
      </ul>
  </section>
</template>
