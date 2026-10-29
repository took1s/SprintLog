<script setup lang="ts">
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
const UNITS = { volume: 'kg', distance: 'm', sessions: '', load: 'AU' } as const;

function render() {
  chart?.destroy();
  chart = renderWeeklyChart(canvas.value, weekly.value, { metric: weeklyMetric.value, unit: UNITS[weeklyMetric.value] });
}
onMounted(render);
watch([weekly, weeklyMetric], render);
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="space-y-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="stat-card">
              <div class="stat-label">This week</div>
              <div class="stat-value">{{ kpis.sessions }}</div>
              <div class="font-mono text-[10px] text-slate-500">sessions · last {{ kpis.sessionsPrev }}</div>
          </div>
          <div class="stat-card">
              <div class="stat-label">Volume</div>
              <div class="stat-value">{{ formatCompact(kpis.volume) }}<span class="ml-1 text-xs text-slate-500">kg</span></div>
              <div class="font-mono text-[10px]" :class="kpis.volumeChange === null ? 'text-slate-500' : kpis.volumeChange >= 0 ? 'text-emerald-400' : 'text-red-400'">
                  {{ kpis.volumeChange === null ? 'no comparison' : (kpis.volumeChange >= 0 ? '▲ ' : '▼ ') + Math.abs(kpis.volumeChange) + '% vs last' }}
              </div>
          </div>
          <div class="stat-card">
              <div class="stat-label">Streak</div>
              <div class="stat-value">{{ kpis.streak }}<span class="ml-1 text-xs text-slate-500">wk</span></div>
              <div class="font-mono text-[10px] text-slate-500">weeks in a row</div>
          </div>
          <div class="stat-card">
              <div class="stat-label">Field</div>
              <div class="stat-value">{{ formatCompact(kpis.distance) }}<span class="ml-1 text-xs text-slate-500">m</span></div>
              <div class="font-mono text-[10px] text-slate-500">distance this week</div>
          </div>
      </div>

      <div class="glass-panel rounded-3xl p-5">
          <div class="mb-4 flex items-center justify-between">
              <h3 class="font-black tracking-wide text-white">Last 12 weeks</h3>
              <div class="flex gap-1">
                  <button v-for="m in [['volume','Vol'],['sessions','Sessions'],['distance','Dist'],['load','Load']]" :key="m[0]" @click="weeklyMetric = m[0]"
                          class="rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-widest" :class="weeklyMetric === m[0] ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-white'">{{ m[1] }}</button>
              </div>
          </div>
          <div class="relative h-48"><canvas ref="weeklyCanvas" aria-label="Weekly totals chart"></canvas></div>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
          <div class="glass-panel rounded-3xl p-5">
              <h3 class="mb-1 font-black tracking-wide text-white">Muscle split</h3>
              <p class="mb-4 font-mono text-[10px] text-slate-500">Sets per group · last 30 days · {{ activeDaysLast30 }} active days</p>
              <div v-if="!muscleSplit.length" class="font-mono text-xs text-slate-500">No sets in the last 30 days.</div>
              <div v-for="m in muscleSplit" :key="m.group" class="mb-3">
                  <div class="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span class="text-slate-300">{{ m.group }}</span><span class="font-mono text-slate-500">{{ m.sets }}</span>
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent" :style="{ width: Math.max(4, m.share / muscleSplit[0].share * 100) + '%' }"></div>
                  </div>
              </div>
          </div>

          <div class="glass-panel rounded-3xl p-5">
              <h3 class="mb-4 font-black tracking-wide text-white">Recent records</h3>
              <div v-if="!recentPRs.length" class="font-mono text-xs text-slate-500">Beat a previous best to see records here.</div>
              <button v-for="(pr, i) in recentPRs" :key="i" @click="openProgress(pr.key)"
                      class="mb-2 flex w-full items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3 text-left transition-colors hover:border-accent/30">
                  <div class="min-w-0">
                      <div class="truncate text-sm font-bold text-white">{{ pr.name }}</div>
                      <div class="font-mono text-[10px] text-slate-500">{{ pr.label }} · {{ formatRelative(pr.date, clockDate) }}</div>
                  </div>
                  <span class="ml-2 whitespace-nowrap rounded border px-2 py-1 text-[9px] font-black uppercase tracking-widest" :class="badgeClass(pr.tone)">{{ pr.icon }} {{ prValue(pr) }}</span>
              </button>
          </div>
      </div>
  </div>
</template>
