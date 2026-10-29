<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, recordHeadline } from '@/stores/app';

import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import type { Chart } from 'chart.js';
import { renderProgressChart } from '@/lib/charts';

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
    label: progressMetric.value.label,
    unit: progressMetric.value.unit,
    lowerIsBetter: !!progressMetric.value.lowerIsBetter,
    field: progressRecord.value.trackingType !== 'WeightReps',
  });
}
onMounted(render);
watch([progressSeries, progressMetric], render);
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div class="glass-panel rounded-3xl p-6">
      <label class="label-xs mb-3 text-accent" for="progress-select">Exercise</label>
      <select id="progress-select" v-model="progress.key" class="cyber-input mb-4 w-full rounded-xl p-3.5 font-mono text-sm outline-none">
          <option disabled value="">Choose exercise...</option>
          <option v-for="r in progressOptions" :key="r.key" :value="r.key">{{ r.name }} ({{ r.sessions }})</option>
      </select>

      <template v-if="progressRecord">
          <div class="mb-4 flex flex-wrap gap-2">
              <button v-for="m in progressMetrics" :key="m.key" @click="progress.metric = m.key" class="chip" :class="progressMetric.key === m.key ? 'chip-active' : 'chip-idle'">{{ m.label }}</button>
          </div>
          <div class="mb-4 grid grid-cols-3 gap-3">
              <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div class="stat-label">Best</div>
                  <div class="mt-1 font-mono text-sm font-black text-white">{{ recordHeadline(progressRecord) }}</div>
              </div>
              <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div class="stat-label">Sessions</div>
                  <div class="mt-1 font-mono text-sm font-black text-white">{{ progressRecord.sessions }}</div>
              </div>
              <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                  <div class="stat-label">Trend</div>
                  <div class="mt-1 font-mono text-sm font-black" :class="progressDelta === null ? 'text-slate-500' : progressDelta >= 0 ? 'text-emerald-400' : 'text-red-400'">
                      {{ progressDelta === null ? '--' : (progressDelta >= 0 ? '+' : '') + progressDelta + '%' }}
                  </div>
              </div>
          </div>
          <div class="relative h-64 w-full rounded-2xl border border-white/5 bg-black/20 p-2">
              <canvas v-show="progressSeries.length" ref="progressCanvas" aria-label="Progress chart"></canvas>
              <p v-if="!progressSeries.length" class="flex h-full items-center justify-center font-mono text-xs text-slate-500">No values for this metric yet.</p>
          </div>
          <p v-if="progressMetric.key === 'e1rm'" class="mt-3 font-mono text-[10px] text-slate-500">Est. 1RM via Epley formula (sets with up to 12 reps).</p>
      </template>
  </div>
</template>
