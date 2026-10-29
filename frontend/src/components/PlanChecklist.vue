<script setup lang="ts">
import { t } from '@/i18n';
import { dayName, exerciseName, noteText, programName } from '@/i18n/content';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { formatNumber } from '@/lib/format';
import { prescriptionText, suggestionNote } from '@/lib/program';

const app = useAppStore();
const { planProgress, planTargets, programs, session, sessionActive } = storeToRefs(app);
// Namen in der aktuellen Sprache (gespeichert ist der Name zum Startzeitpunkt).
const planProgram = computed(() => programs.value.find((p) => p.id === session.value.plan?.programId) ?? null);
const planDay = computed(() => planProgram.value?.days.find((d) => d.id === session.value.plan?.dayId) ?? null);
const { abortSession, finishSession, openPlanTarget } = app;
</script>

<template>
  <div v-if="session.plan" class="glass-panel mb-6 rounded-3xl border border-accent/30 p-5">
      <div class="mb-3 flex items-start justify-between gap-3">
          <div>
              <div class="text-[10px] font-bold uppercase tracking-widest text-accent">{{ planProgram ? programName(planProgram) : session.plan.programName }}</div>
              <h3 class="text-xl font-black text-white">{{ planProgram && planDay ? dayName(planProgram, planDay) : session.plan.dayName }}</h3>
          </div>
          <div class="text-right">
              <div class="font-mono text-lg font-black text-white">{{ planProgress.done }}/{{ planProgress.total }}</div>
              <div class="font-mono text-[9px] uppercase tracking-widest text-slate-500">{{ t('plan.sets') }}</div>
          </div>
      </div>
      <div class="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5"><div class="h-full rounded-full bg-accent transition-all" :style="{ width: planProgress.percent + '%' }"></div></div>
      <div class="space-y-2">
          <button v-for="target in planTargets" :key="target.id" @click="openPlanTarget(target)"
                  class="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:border-accent/50"
                  :class="target.done >= target.sets ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-white/5 bg-black/20'">
              <div class="min-w-0">
                  <div class="truncate text-sm font-bold" :class="target.done >= target.sets ? 'text-emerald-300' : 'text-white'">{{ exerciseName(target.exerciseId, target.exerciseName) }}</div>
                  <div class="font-mono text-[10px] text-slate-400">{{ prescriptionText(target) }}</div>
                  <div v-if="target.note" class="font-mono text-[10px] text-accent/70">{{ noteText(target.note) }}</div>
                  <div class="font-mono text-[10px]" :class="target.suggestion.kind === 'progress' ? 'text-yellow-400' : target.suggestion.kind === 'deload' ? 'text-emerald-300' : 'text-slate-500'">
                      <template v-if="target.suggestion.weight != null">{{ target.suggestion.weight > 0 ? `${formatNumber(target.suggestion.weight, 2)} ${t('units.kg')}` : t('set.bodyweight') }} × {{ target.suggestion.reps }} · </template>{{ suggestionNote(target.suggestion) }}
                  </div>
              </div>
              <div v-if="target.sets <= 8" class="flex flex-shrink-0 gap-1">
                  <span v-for="n in target.sets" :key="n" class="h-2.5 w-2.5 rounded-full" :class="n <= target.done ? 'bg-emerald-400' : 'bg-white/10'"></span>
              </div>
              <span v-else class="flex-shrink-0 font-mono text-xs font-bold" :class="target.done >= target.sets ? 'text-emerald-300' : 'text-slate-400'">{{ Math.min(target.done, target.sets) }}/{{ target.sets }}</span>
          </button>
      </div>
      <div class="mt-4 flex justify-between gap-2">
          <button @click="abortSession" class="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-400">{{ t('plan.endDay') }}</button>
          <button v-if="sessionActive" @click="finishSession" class="cyber-btn rounded-xl px-4 py-2 text-xs font-bold">{{ t('plan.finish') }}</button>
      </div>
  </div>
</template>
