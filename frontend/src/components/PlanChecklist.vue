<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { formatNumber } from '@/lib/format';
import { prescriptionText } from '@/lib/program';

const app = useAppStore();
const { planProgress, planTargets, session, sessionActive } = storeToRefs(app);
const { abortSession, finishSession, openPlanTarget } = app;
</script>

<template>
  <div v-if="session.plan" class="glass-panel mb-6 rounded-3xl border border-accent/30 p-5">
      <div class="mb-3 flex items-start justify-between gap-3">
          <div>
              <div class="text-[10px] font-bold uppercase tracking-widest text-accent">{{ session.plan.programName }}</div>
              <h3 class="text-xl font-black text-white">{{ session.plan.dayName }}</h3>
          </div>
          <div class="text-right">
              <div class="font-mono text-lg font-black text-white">{{ planProgress.done }}/{{ planProgress.total }}</div>
              <div class="font-mono text-[9px] uppercase tracking-widest text-slate-500">sets</div>
          </div>
      </div>
      <div class="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5"><div class="h-full rounded-full bg-accent transition-all" :style="{ width: planProgress.percent + '%' }"></div></div>
      <div class="space-y-2">
          <button v-for="t in planTargets" :key="t.id" @click="openPlanTarget(t)"
                  class="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all hover:border-accent/50"
                  :class="t.done >= t.sets ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-white/5 bg-black/20'">
              <div class="min-w-0">
                  <div class="truncate text-sm font-bold" :class="t.done >= t.sets ? 'text-emerald-300' : 'text-white'">{{ t.exerciseName }}</div>
                  <div class="font-mono text-[10px] text-slate-400">{{ prescriptionText(t) }}</div>
                  <div class="font-mono text-[10px]" :class="t.suggestion.kind === 'progress' ? 'text-yellow-400' : 'text-slate-500'">
                      <template v-if="t.suggestion.weight != null">{{ formatNumber(t.suggestion.weight, 2) }} kg × {{ t.suggestion.reps }} · </template>{{ t.suggestion.note }}
                  </div>
              </div>
              <div class="flex flex-shrink-0 gap-1">
                  <span v-for="n in t.sets" :key="n" class="h-2.5 w-2.5 rounded-full" :class="n <= t.done ? 'bg-emerald-400' : 'bg-white/10'"></span>
              </div>
          </button>
      </div>
      <div class="mt-4 flex justify-between gap-2">
          <button @click="abortSession" class="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-400">End plan day</button>
          <button v-if="sessionActive" @click="finishSession" class="cyber-btn rounded-xl px-4 py-2 text-xs font-bold">Finish</button>
      </div>
  </div>
</template>
