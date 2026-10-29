<script setup lang="ts">
import { t, locale } from '@/i18n';
import { exerciseNameByKey, muscleName } from '@/i18n/content';

const WEEKLY = ['volume', 'sessions', 'distance', 'load'] as const;
import { storeToRefs } from 'pinia';
import { useAppStore, badgeClass, prValue } from '@/stores/app';
import { formatCompact, formatRelative } from '@/lib/format';

import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import type { Chart } from 'chart.js';
import { renderWeeklyChart } from '@/lib/charts';

const app = useAppStore();
const { activeDaysLast30, clockDate, kpis, muscleSplit, recentPRs, weeklyMetric, weekly } = storeToRefs(app);
const { openProgress } = app;

// Chart-Instanz bewusst NICHT reaktiv (Vue-Proxies um Chart.js kosten viel Performance).
const canvas = useTemplateRef<HTMLCanvasElement>('weeklyCanvas');
let chart: Chart | null = null;
const UNITS = { volume: 'units.kg', distance: 'units.m', sessions: '', load: 'units.au' } as const;

function render() {
  chart?.destroy();
  const unit = UNITS[weeklyMetric.value];
  chart = renderWeeklyChart(canvas.value, weekly.value, { metric: weeklyMetric.value, unit: unit ? t(unit) : '' });
}
onMounted(render);
watch([weekly, weeklyMetric, locale], render);
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="space-y-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="stat-card">
              <div class="stat-label">{{ t('data.thisWeek') }}</div>
              <div class="stat-value">{{ kpis.sessions }}</div>
              <div class="font-mono text-[10px] text-slate-500">{{ t('data.sessionsLast', { n: kpis.sessionsPrev }) }}</div>
          </div>
          <div class="stat-card">
              <div class="stat-label">{{ t('data.volume') }}</div>
              <div class="stat-value">{{ formatCompact(kpis.volume) }}<span class="ml-1 text-xs text-slate-500">{{ t('units.kg') }}</span></div>
              <div class="font-mono text-[10px]" :class="kpis.volumeChange === null ? 'text-slate-500' : kpis.volumeChange >= 0 ? 'text-emerald-400' : 'text-red-400'">
                  {{ kpis.volumeChange === null ? t('data.noComparison') : t('data.vsLast', { arrow: kpis.volumeChange >= 0 ? '▲' : '▼', pct: Math.abs(kpis.volumeChange) }) }}
              </div>
          </div>
          <div class="stat-card">
              <div class="stat-label">{{ t('data.streak') }}</div>
              <div class="stat-value">{{ kpis.streak }}<span class="ml-1 text-xs text-slate-500">{{ t('units.wk') }}</span></div>
              <div class="font-mono text-[10px] text-slate-500">{{ t('data.weeksInRow') }}</div>
          </div>
          <div class="stat-card">
              <div class="stat-label">{{ t('data.field') }}</div>
              <div class="stat-value">{{ formatCompact(kpis.distance) }}<span class="ml-1 text-xs text-slate-500">{{ t('units.m') }}</span></div>
              <div class="font-mono text-[10px] text-slate-500">{{ t('data.distanceThisWeek') }}</div>
          </div>
      </div>

      <div class="glass-panel rounded-3xl p-5">
          <div class="mb-4 flex items-center justify-between">
              <h3 class="font-black tracking-wide text-white">{{ t('data.last12') }}</h3>
              <div class="flex gap-1">
                  <button v-for="m in WEEKLY" :key="m" @click="weeklyMetric = m"
                          class="rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-widest" :class="weeklyMetric === m ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-white'">{{ t(`data.weeklyMetric.${m}`) }}</button>
              </div>
          </div>
          <div class="relative h-48"><canvas ref="weeklyCanvas" :aria-label="t('data.weeklyChart')"></canvas></div>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
          <div class="glass-panel rounded-3xl p-5">
              <h3 class="mb-1 font-black tracking-wide text-white">{{ t('data.muscleSplit') }}</h3>
              <p class="mb-4 font-mono text-[10px] text-slate-500">{{ t('data.muscleInfo', { days: activeDaysLast30 }) }}</p>
              <div v-if="!muscleSplit.length" class="font-mono text-xs text-slate-500">{{ t('data.noSets30') }}</div>
              <div v-for="m in muscleSplit" :key="m.group" class="mb-3">
                  <div class="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span class="text-slate-300">{{ muscleName(m.group) }}</span><span class="font-mono text-slate-500">{{ m.sets }}</span>
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent" :style="{ width: Math.max(4, m.share / muscleSplit[0].share * 100) + '%' }"></div>
                  </div>
              </div>
          </div>

          <div class="glass-panel rounded-3xl p-5">
              <h3 class="mb-4 font-black tracking-wide text-white">{{ t('data.recentRecords') }}</h3>
              <div v-if="!recentPRs.length" class="font-mono text-xs text-slate-500">{{ t('data.noRecords') }}</div>
              <button v-for="(pr, i) in recentPRs" :key="i" @click="openProgress(pr.key)"
                      class="mb-2 flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3 text-left transition-colors hover:border-accent/30">
                  <div class="min-w-0">
                      <div class="truncate text-sm font-bold text-white">{{ exerciseNameByKey(pr.key, pr.name) }}</div>
                      <div class="font-mono text-[10px] text-slate-500">{{ t(`records.badges.${pr.field}`) }} · {{ formatRelative(pr.date, clockDate) }}</div>
                  </div>
                  <span class="ml-2 whitespace-nowrap rounded border px-2 py-1 text-[9px] font-black uppercase tracking-widest" :class="badgeClass(pr.tone)">{{ pr.icon }} {{ prValue(pr) }}</span>
              </button>
          </div>
      </div>
  </div>
</template>
