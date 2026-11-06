<script setup lang="ts">
// Fortschritt: oben die gewählte Übung (aktueller Wert, Veränderung, Diagramm mit Zeitraum, letzte Einheiten),
// darunter alle Übungen mit Mini-Linie und Trend zum schnellen Wechseln - statt einer langen Auswahlliste.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { Chart } from 'chart.js';
import { storeToRefs } from 'pinia';
import { t, tn, locale } from '@/i18n';
import { exerciseName, unitLabel } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { renderProgressChart } from '@/lib/charts';
import { appearance, activeScheme } from '@/lib/theme';
import { formatClock, formatDate, formatNumber } from '@/lib/format';
import { tap } from '@/lib/native';
import type { MetricOption } from '@/lib/analytics';
import {
  exerciseTrends, inRange, matchesQuery, sortTrends, sparkPoints, summarize, usefulRanges,
  type ExerciseTrend, type ProgressRange, type TrendSort,
} from '@/lib/progress';

const app = useAppStore();
const { progress, progressMetric, progressMetrics, progressRecord, progressSeries, records, allWorkouts, clockDate } = storeToRefs(app);

// ---------- Werte lesbar machen ----------
/** Wert + Einheit getrennt (große Zahl, kleine Einheit). Lange Dauern als m:ss. */
function parts(value: number | null | undefined, metric: MetricOption): { value: string; unit: string } {
  if (value == null) return { value: '--', unit: '' };
  if (metric.unit === 's' && value >= 60) return { value: formatClock(Math.round(value)), unit: '' };
  const digits = metric.unit === 'm' || metric.unit === 'reps' ? 0 : metric.unit === 's' ? 2 : metric.unit === 'kg' ? 2 : 1;
  return { value: formatNumber(value, digits), unit: unitLabel(metric.unit) };
}
const text = (value: number | null | undefined, metric: MetricOption) => {
  const p = parts(value, metric);
  return p.unit ? `${p.value} ${p.unit}` : p.value;
};
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
/** Schritt mit Vorzeichen in Zahlenformat der Sprache (Komma), Nachkommastellen wie beim Wert. */
const signedValue = (n: number, metric: MetricOption) => {
  const digits = metric.unit === 'm' || metric.unit === 'reps' ? 0 : 2;
  const s = formatNumber(Math.abs(n), digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
};
const nameOf = (tr: Pick<ExerciseTrend, 'record'>) => exerciseName(tr.record.exerciseId, tr.record.name);
const isField = computed(() => !!progressRecord.value && progressRecord.value.trackingType !== 'WeightReps');

// ---------- Gewählte Übung ----------
const ranges = computed(() => usefulRanges(progressSeries.value, clockDate.value));
const range = computed<ProgressRange>(() => (ranges.value.includes(progress.value.range) ? progress.value.range : 'all'));
const series = computed(() => inRange(progressSeries.value, range.value, clockDate.value));
const summary = computed(() => summarize(series.value, !!progressMetric.value.lowerIsBetter));
const headline = computed(() => parts(summary.value?.latest.value, progressMetric.value));
const lowerIsBetter = computed(() => !!progressMetric.value.lowerIsBetter);

/** Letzte Einheiten (neueste zuerst) mit Schritt zur vorherigen - "besser" ist grün, auch bei Zeiten. */
const recent = computed(() => {
  const s = series.value;
  const best = summary.value?.best.value;
  return s.slice(-5).reverse().map((p, i) => {
    const prev = s[s.length - 2 - i];
    const raw = prev ? Math.round((p.value - prev.value) * 100) / 100 : null;
    const step = raw === null ? null : lowerIsBetter.value ? -raw : raw;
    return { ...p, step, isBest: p.value === best };
  });
});

function setRange(r: ProgressRange) {
  if (r === progress.value.range) return;
  tap();
  progress.value.range = r;
}

// ---------- Diagramm ----------
const canvas = useTemplateRef<HTMLCanvasElement>('progressCanvas');
let chart: Chart | null = null;
async function render() {
  await nextTick(); // Canvas erscheint erst, wenn eine Übung gewählt ist
  chart?.destroy();
  chart = null;
  if (!series.value.length || !progressRecord.value) return;
  chart = renderProgressChart(canvas.value, series.value, {
    label: t(`progress.metrics.${progressMetric.value.key}`),
    unit: unitLabel(progressMetric.value.unit),
    lowerIsBetter: lowerIsBetter.value,
    field: isField.value,
  });
}
onMounted(render);
watch([series, progressMetric, locale, appearance, activeScheme], render); // auch Theme-Wechsel: neu zeichnen
onBeforeUnmount(() => chart?.destroy());

// ---------- Alle Übungen ----------
const query = ref('');
const sort = ref<TrendSort>('recent');
const expanded = ref(false);
const SORTS: readonly TrendSort[] = ['recent', 'sessions', 'growth'];
const LIMIT = 8;

const trends = computed(() => exerciseTrends(records.value.values(), allWorkouts.value, clockDate.value));
const filtered = computed(() => sortTrends(trends.value, sort.value, nameOf).filter((tr) => matchesQuery(nameOf(tr), query.value)));
const visible = computed(() => (expanded.value || query.value ? filtered.value : filtered.value.slice(0, LIMIT)));

const hero = useTemplateRef<HTMLElement>('hero');
const list = useTemplateRef<HTMLElement>('list');
const search = useTemplateRef<HTMLInputElement>('search');

function pick(key: string) {
  if (key !== progress.value.key) {
    tap();
    progress.value.key = key;
  }
  // Zur Karte oben (unter der klebenden Leiste), damit man den Verlauf sofort sieht
  const top = (hero.value?.getBoundingClientRect().top ?? 0) + window.scrollY - 96;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function toList() {
  const top = (list.value?.getBoundingClientRect().top ?? 0) + window.scrollY - 96;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  window.setTimeout(() => search.value?.focus({ preventScroll: true }), 350);
}
</script>

<template>
  <div class="space-y-5">
    <!-- Gewählte Übung -->
    <section ref="hero" class="glass-panel rounded-3xl p-5 sm:p-6" data-test="progress-hero">
      <template v-if="progressRecord">
        <div class="flex items-start justify-between gap-3">
          <button type="button" class="prog-title group min-w-0 text-left" @click="toList" :aria-label="t('progress.changeExercise')">
            <span class="label-xs text-accent">{{ t('progress.kicker') }}</span>
            <span class="mt-1 flex items-center gap-1.5">
              <span class="display truncate text-2xl text-white" data-test="progress-name">{{ exerciseName(progressRecord.exerciseId, progressRecord.name) }}</span>
              <svg class="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>
          <span class="prog-count">{{ tn('units.workouts', progressRecord.sessions) }}</span>
        </div>

        <!-- Aktueller Wert + Veränderung im Zeitraum -->
        <div class="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
          <p class="font-mono text-4xl font-black leading-none text-white" data-test="progress-latest">
            {{ headline.value }}<span v-if="headline.unit" class="ml-1 text-base font-bold text-slate-400">{{ headline.unit }}</span>
          </p>
          <span v-if="summary?.change != null" class="prog-delta" :class="summary.change > 0 ? 'is-up' : summary.change < 0 ? 'is-down' : ''">
            <svg v-if="summary.change !== 0" class="h-3 w-3" viewBox="0 0 12 12" aria-hidden="true"><path :d="summary.change > 0 ? 'M6 2l4 6H2z' : 'M6 10L2 4h8z'" fill="currentColor" /></svg>
            {{ signed(summary.change) }}%
            <span class="font-sans font-semibold opacity-70">{{ t('progress.inRange') }}</span>
          </span>
        </div>
        <p v-if="summary" class="mt-2 text-xs text-slate-400">
          {{ t(`progress.metrics.${progressMetric.key}`) }} · {{ formatDate(summary.latest.date, { day: 'numeric', month: 'short' }) }}
          <template v-if="!summary.latestIsBest"> · {{ t('progress.best') }} {{ text(summary.best.value, progressMetric) }}</template>
          <span v-else class="prog-best-tag">{{ t('progress.newBest') }}</span>
        </p>

        <!-- Kennzahl -->
        <div v-if="progressMetrics.length > 1" class="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <button v-for="m in progressMetrics" :key="m.key" type="button" @click="progress.metric = m.key"
                  class="chip flex-shrink-0" :class="progressMetric.key === m.key ? 'chip-active' : 'chip-idle'" :aria-pressed="progressMetric.key === m.key">
            {{ t(`progress.metrics.${m.key}`) }}
          </button>
        </div>

        <!-- Diagramm -->
        <div class="relative mt-4 h-56 w-full">
          <canvas v-show="series.length" ref="progressCanvas" :aria-label="t('progress.chart')"></canvas>
          <p v-if="!series.length" class="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 text-center font-mono text-xs text-slate-500">{{ t('progress.noValues') }}</p>
        </div>

        <!-- Zeitraum (nur die, die wirklich etwas weglassen) -->
        <div v-if="ranges.length > 1" class="prog-range mt-3" role="group" :aria-label="t('progress.rangeLabel')">
          <button v-for="r in ranges" :key="r" type="button" class="prog-range-btn" :class="{ 'is-active': range === r }"
                  :aria-pressed="range === r" @click="setRange(r)" :data-range="r">{{ t(`progress.ranges.${r}`) }}</button>
        </div>

        <!-- Kennzahlen -->
        <div v-if="summary" class="mt-4 grid grid-cols-3 gap-2">
          <div class="prog-stat">
            <div class="stat-label">{{ t('progress.best') }}</div>
            <div class="prog-stat-value text-yellow-400">{{ text(summary.best.value, progressMetric) }}</div>
            <div class="prog-stat-sub">{{ formatDate(summary.best.date, { day: 'numeric', month: 'short' }) }}</div>
          </div>
          <div class="prog-stat">
            <div class="stat-label">{{ t('progress.sessions') }}</div>
            <div class="prog-stat-value">{{ summary.count }}</div>
            <div class="prog-stat-sub">{{ t('progress.inRange') }}</div>
          </div>
          <div class="prog-stat">
            <div class="stat-label">{{ t('progress.step') }}</div>
            <div class="prog-stat-value" :class="summary.lastStep == null || summary.lastStep === 0 ? '' : summary.lastStep > 0 ? 'text-emerald-400' : 'text-red-400'">
              {{ summary.lastStep == null ? '--' : signedValue(summary.lastStep, progressMetric) }}
            </div>
            <div class="prog-stat-sub">{{ summary.lastStep == null ? '' : unitLabel(progressMetric.unit) }}</div>
          </div>
        </div>
        <p v-if="progressMetric.key === 'e1rm'" class="mt-3 font-mono text-[10px] text-slate-500">{{ t('progress.e1rmInfo') }}</p>

        <!-- Letzte Einheiten -->
        <div v-if="recent.length" class="mt-5">
          <h3 class="label-xs mb-2">{{ t('progress.recent') }}</h3>
          <ol class="prog-recent" data-test="progress-recent">
            <li v-for="p in recent" :key="p.date" class="flex items-center gap-3 py-2.5">
              <span class="w-16 flex-shrink-0 text-xs text-slate-400">{{ formatDate(p.date, { day: 'numeric', month: 'short' }) }}</span>
              <span class="flex-1 font-mono text-sm font-bold text-white">
                {{ text(p.value, progressMetric) }}
                <span v-if="p.isBest" class="prog-best-tag">{{ t('progress.newBest') }}</span>
              </span>
              <span class="w-16 text-right font-mono text-xs" :class="p.step == null || p.step === 0 ? 'text-slate-500' : p.step > 0 ? 'text-emerald-400' : 'text-red-400'">
                {{ p.step == null ? '' : p.step === 0 ? '=' : signedValue(p.step, progressMetric) }}
              </span>
            </li>
          </ol>
        </div>
      </template>
      <p v-else class="py-8 text-center font-mono text-xs text-slate-500">{{ t('progress.choose') }}</p>
    </section>

    <!-- Alle Übungen -->
    <section ref="list" class="glass-panel rounded-3xl p-5 sm:p-6" data-test="progress-list">
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="display text-lg text-white">{{ t('progress.all') }}</h3>
        <span class="font-mono text-xs text-slate-500">{{ trends.length }}</span>
      </div>

      <label class="relative mt-3 block">
        <span class="sr-only">{{ t('progress.search') }}</span>
        <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input ref="search" v-model="query" type="search" enterkeyhint="search" :placeholder="t('progress.search')"
               class="cyber-input w-full rounded-xl py-3 pl-10 pr-3 text-sm outline-none" data-test="progress-search" />
      </label>

      <div class="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <button v-for="s in SORTS" :key="s" type="button" class="chip flex-shrink-0" :class="sort === s ? 'chip-active' : 'chip-idle'"
                :aria-pressed="sort === s" @click="sort = s">{{ t(`progress.sort.${s}`) }}</button>
      </div>

      <ul class="mt-3 space-y-1.5">
        <li v-for="tr in visible" :key="tr.key">
          <button type="button" class="prog-row" :class="{ 'is-active': tr.key === progress.key }" :aria-current="tr.key === progress.key ? 'true' : undefined"
                  @click="pick(tr.key)" :data-exercise="tr.key">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-bold text-white">{{ nameOf(tr) }}</span>
              <span class="mt-0.5 block truncate text-[11px] text-slate-400">
                {{ tn('units.workouts', tr.record.sessions) }}<template v-if="tr.lastDate"> · {{ formatDate(tr.lastDate, { day: 'numeric', month: 'short' }) }}</template>
              </span>
            </span>
            <svg class="prog-spark" :class="tr.record.trackingType === 'WeightReps' ? 'text-accent' : 'text-emerald-400'" viewBox="0 0 64 24" aria-hidden="true">
              <polyline v-if="tr.recent.length > 1" :points="sparkPoints(tr.recent, 64, 24, 3)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <circle v-else cx="32" cy="12" r="2.5" fill="currentColor" />
            </svg>
            <span class="w-[4.5rem] flex-shrink-0 text-right">
              <span class="block truncate font-mono text-xs font-bold text-white">{{ text(tr.latest, tr.metric) }}</span>
              <span class="block font-mono text-[10px]" :class="tr.change == null || tr.change === 0 ? 'text-slate-500' : tr.change > 0 ? 'text-emerald-400' : 'text-red-400'"
                    :title="t('progress.trendHint')">
                {{ tr.change == null ? '--' : `${signed(tr.change)}%` }}
              </span>
            </span>
          </button>
        </li>
      </ul>
      <p v-if="!filtered.length" class="py-6 text-center text-xs text-slate-500">{{ t('progress.noMatch') }}</p>
      <button v-if="!query && filtered.length > LIMIT" type="button" class="mt-3 w-full rounded-xl py-3 text-xs font-bold text-accent transition-colors hover:bg-white/5"
              @click="expanded = !expanded">
        {{ expanded ? t('progress.showLess') : t('progress.showAll', { n: filtered.length }) }}
      </button>
    </section>
  </div>
</template>
