<script setup lang="ts">
import { t, locale } from '@/i18n';
import { exerciseNameByKey, muscleName } from '@/i18n/content';

const WEEKLY = ['volume', 'sessions', 'distance', 'load'] as const;
import { storeToRefs } from 'pinia';
import { useAppStore, prValue } from '@/stores/app';
import { formatCompact, formatRelative } from '@/lib/format';

import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import type { Chart } from 'chart.js';
import { renderWeeklyChart } from '@/lib/charts';
import { appearance, activeScheme } from '@/lib/theme';

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
watch([weekly, weeklyMetric, locale, appearance, activeScheme], render); // Theme-Wechsel: neu zeichnen
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="space-y-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="stat-card">
              <div class="stat-label">{{ t('data.thisWeek') }}</div>
              <div class="stat-value">{{ kpis.sessions }}</div>
              <div class="font-mono text-tiny text-slate-500">{{ t('data.sessionsLast', { n: kpis.sessionsPrev }) }}</div>
          </div>
          <div class="stat-card">
              <div class="stat-label">{{ t('data.volume') }}</div>
              <div class="stat-value">{{ formatCompact(kpis.volume) }}<span class="ml-1 text-xs text-slate-500">{{ t('units.kg') }}</span></div>
              <!-- Die Woche läuft noch: weniger als letzte Woche ist kein Alarm (grau statt rot); ohne Kraft gar kein Vergleich -->
              <div class="font-mono text-tiny" :class="kpis.volumeChange !== null && kpis.volumeChange > 0 && kpis.volume ? 'text-emerald-400' : 'text-slate-500'">
                  {{ !kpis.volume ? t('data.noVolumeYet') : kpis.volumeChange === null ? t('data.noComparison') : t('data.vsLast', { arrow: kpis.volumeChange >= 0 ? '▲' : '▼', pct: Math.abs(kpis.volumeChange) }) }}
              </div>
          </div>
          <div class="stat-card">
              <div class="stat-label">{{ t('data.streak') }}</div>
              <div class="stat-value">{{ kpis.streak }}<span class="ml-1 text-xs text-slate-500">{{ t('units.wk') }}</span></div>
              <div class="font-mono text-tiny text-slate-500">{{ t('data.weeksInRow') }}</div>
          </div>
          <div class="stat-card">
              <div class="stat-label">{{ t('data.field') }}</div>
              <div class="stat-value">{{ formatCompact(kpis.distance) }}<span class="ml-1 text-xs text-slate-500">{{ t('units.m') }}</span></div>
              <div class="font-mono text-tiny text-slate-500">{{ t('data.distanceThisWeek') }}</div>
          </div>
      </div>

      <div class="glass-panel rounded-3xl p-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 class="display text-white">{{ t('data.last12') }}</h3>
              <div class="flex flex-wrap gap-1">
                  <button v-for="m in WEEKLY" :key="m" @click="weeklyMetric = m"
                          class="rounded-full px-3 py-1.5 text-xs font-semibold caps tracking-label" :class="weeklyMetric === m ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'" :aria-pressed="weeklyMetric === m">{{ t(`data.weeklyMetric.${m}`) }}</button>
              </div>
          </div>
          <div class="relative h-48"><canvas ref="weeklyCanvas" :aria-label="t('data.weeklyChart')"></canvas></div>
      </div>

      <div class="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2">
          <div class="glass-panel min-w-0 rounded-3xl p-5">
              <h3 class="mb-1 display text-white">{{ t('data.muscleSplit') }}</h3>
              <p class="mb-4 font-mono text-tiny text-slate-500">{{ t('data.muscleInfo', { days: activeDaysLast30 }) }}</p>
              <div v-if="!muscleSplit.length" class="font-mono text-xs text-slate-500">{{ t('data.noSets30') }}</div>
              <div v-for="m in muscleSplit" :key="m.group" class="mb-3">
                  <div class="mb-1 flex justify-between text-tiny font-bold caps tracking-widest">
                      <span class="text-slate-300">{{ muscleName(m.group) }}</span><span class="font-mono text-slate-500">{{ m.sets }}</span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div class="bar-accent h-full rounded-full" :style="{ width: Math.max(4, m.share / muscleSplit[0].share * 100) + '%' }"></div>
                  </div>
              </div>
          </div>

          <div class="glass-panel rounded-3xl p-5">
              <h3 class="mb-4 display text-white">{{ t('data.recentRecords') }}</h3>
              <div v-if="!recentPRs.length" class="font-mono text-xs text-slate-500">{{ t('data.noRecords') }}</div>
              <!-- Liste statt Karten in der Karte; der Wert rechts, ohne Emoji-Abzeichen -->
              <ul class="-mx-2">
                  <li v-for="(pr, i) in recentPRs" :key="i" class="border-t border-white/5 first:border-t-0">
                      <button type="button" @click="openProgress(pr.key)" class="flex min-h-[3.5rem] w-full items-center justify-between gap-3 rounded-xl px-2 text-left transition-colors hover:bg-white/5">
                          <span class="min-w-0">
                              <span class="block truncate text-[15px] font-semibold text-white">{{ exerciseNameByKey(pr.key, pr.name) }}</span>
                              <span class="block truncate text-xs text-slate-500">{{ t(`records.badges.${pr.field}`) }} · {{ formatRelative(pr.date, clockDate) }}</span>
                          </span>
                          <span class="whitespace-nowrap font-mono text-[15px] font-bold text-white">{{ prValue(pr) }}</span>
                      </button>
                  </li>
              </ul>
          </div>
      </div>
  </div>
</template>
