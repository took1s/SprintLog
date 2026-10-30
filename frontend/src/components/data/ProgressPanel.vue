<script setup lang="ts">
import { t, locale } from '@/i18n';
import { exerciseName, unitLabel } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore, recordHeadline } from '@/stores/app';

import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import type { Chart } from 'chart.js';
import { renderProgressChart } from '@/lib/charts';
import { appearance, activeScheme } from '@/lib/theme';

const app = useAppStore();
const { progress, progressDelta, progressMetric, progressMetrics, progressOptions, progressRecord, progressSeries } = storeToRefs(app);

const canvas = useTemplateRef<HTMLCanvasElement>('progressCanvas');
let chart: Chart | null = null;

async function render() {
  await nextTick(); // Canvas erscheint erst, wenn eine Übung gewählt ist
  chart?.destroy();
  chart = null;
  if (!progressSeries.value.length || !progressRecord.value) return;
  chart = renderProgressChart(canvas.value, progressSeries.value, {
    label: t(`progress.metrics.${progressMetric.value.key}`),
    unit: unitLabel(progressMetric.value.unit),
    lowerIsBetter: !!progressMetric.value.lowerIsBetter,
    field: progressRecord.value.trackingType !== 'WeightReps',
  });
}
onMounted(render);
watch([progressSeries, progressMetric, locale, appearance, activeScheme], render); // Theme-Wechsel: neu zeichnen
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="glass-panel rounded-3xl p-6">
      <label class="label-xs mb-3 text-accent" for="progress-select">{{ t('progress.exercise') }}</label>
      <select id="progress-select" v-model="progress.key" class="cyber-input mb-4 w-full rounded-xl p-3.5 font-mono text-sm outline-none">
          <option disabled value="">{{ t('progress.choose') }}</option>
          <option v-for="r in progressOptions" :key="r.key" :value="r.key">{{ exerciseName(r.exerciseId, r.name) }} ({{ r.sessions }})</option>
      </select>

      <template v-if="progressRecord">
          <div class="mb-4 flex flex-wrap gap-2">
              <button v-for="m in progressMetrics" :key="m.key" @click="progress.metric = m.key" class="chip" :class="progressMetric.key === m.key ? 'chip-active' : 'chip-idle'">{{ t(`progress.metrics.${m.key}`) }}</button>
          </div>
          <div class="mb-4 grid grid-cols-3 gap-3">
              <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div class="stat-label">{{ t('progress.best') }}</div>
                  <div class="mt-1 font-mono text-sm font-black text-white">{{ recordHeadline(progressRecord) }}</div>
              </div>
              <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div class="stat-label">{{ t('progress.sessions') }}</div>
                  <div class="mt-1 font-mono text-sm font-black text-white">{{ progressRecord.sessions }}</div>
              </div>
              <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div class="stat-label">{{ t('progress.trend') }}</div>
                  <div class="mt-1 font-mono text-sm font-black" :class="progressDelta === null ? 'text-slate-500' : progressDelta >= 0 ? 'text-emerald-400' : 'text-red-400'">
                      {{ progressDelta === null ? '--' : (progressDelta >= 0 ? '+' : '') + progressDelta + '%' }}
                  </div>
              </div>
          </div>
          <div class="relative h-64 w-full rounded-2xl border border-white/5 bg-black/20 p-2">
              <canvas v-show="progressSeries.length" ref="progressCanvas" :aria-label="t('progress.chart')"></canvas>
              <p v-if="!progressSeries.length" class="flex h-full items-center justify-center font-mono text-xs text-slate-500">{{ t('progress.noValues') }}</p>
          </div>
          <p v-if="progressMetric.key === 'e1rm'" class="mt-3 font-mono text-[10px] text-slate-500">{{ t('progress.e1rmInfo') }}</p>
      </template>
  </div>
</template>
