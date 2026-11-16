<script setup lang="ts">
// Verlauf: Gewicht 8 Wochen (Punkte = Tage, Linie = 7-Tage-Mittel, Achse mit Werten und Daten) und Eiweiß 14 Tage
// (Balken, Zielband 1,6-2,2 g/kg, Tage im Ziel). Antippen eines Balkens zeigt den Wert.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { useAthleteStore, weightTrend, proteinTarget } from '@/stores/athlete';
import { addDays, parseDay } from '@/lib/routines';

const athlete = useAthleteStore();
const { daily, today, latestWeight } = storeToRefs(athlete);
const fmtKg = (v: number) => v.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const short = (d: string) => parseDay(d).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });

// ---------- Gewicht ----------
const W = 300, H = 110, PAD_L = 34, PAD_B = 16;
const trend = computed(() => weightTrend(daily.value, today.value, 56));
const chart = computed(() => {
  const pts = trend.value;
  const vals = pts.flatMap((p) => [p.value, p.avg]).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  let min = Math.floor((Math.min(...vals) - 0.3) * 2) / 2, max = Math.ceil((Math.max(...vals) + 0.3) * 2) / 2;
  if (max - min < 2) { const mid = (max + min) / 2; min = mid - 1; max = mid + 1; }
  const x = (i: number) => PAD_L + (i / (pts.length - 1)) * (W - PAD_L - 4);
  const y = (v: number) => 6 + (1 - (v - min) / (max - min)) * (H - PAD_B - 10);
  const ticks = [max, (max + min) / 2, min].map((v) => ({ v, y: y(v) }));
  return {
    dots: pts.map((p, i) => (p.value == null ? null : { x: x(i), y: y(p.value), k: i })).filter(Boolean) as { x: number; y: number; k: number }[],
    line: pts.map((p, i) => (p.avg == null ? null : `${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`)).filter(Boolean).join(' '),
    ticks,
    dates: [0, 28, 55].map((i, k) => ({ x: x(i), label: short(pts[i]!.day), anchor: k === 0 ? 'start' : k === 2 ? 'end' : 'middle' })),
  };
});
const first = computed(() => trend.value.find((p) => p.avg != null)?.avg ?? null);
const last = computed(() => [...trend.value].reverse().find((p) => p.avg != null)?.avg ?? null);
const change8 = computed(() => (first.value != null && last.value != null ? Math.round((last.value - first.value) * 10) / 10 : null));

// ---------- Eiweiß ----------
const target = computed(() => proteinTarget(latestWeight.value));
const days14 = computed(() => Array.from({ length: 14 }, (_, i) => {
  const day = addDays(today.value, i - 13);
  return { day, g: daily.value.find((d) => d.day === day)?.proteinG ?? 0 };
}));
const maxG = computed(() => Math.max(target.value?.max ?? 0, ...days14.value.map((d) => d.g), 1) * 1.08);
const onTarget = computed(() => (target.value ? days14.value.slice(-7).filter((d) => d.g >= target.value!.min).length : null));
const avg7 = computed(() => { const l = days14.value.slice(-7).filter((d) => d.g > 0); return l.length ? Math.round(l.reduce((a, b) => a + b.g, 0) / l.length) : null; });
const picked = ref<string | null>(null);
const pickedDay = computed(() => days14.value.find((d) => d.day === picked.value) ?? null);
const weekday = (d: string) => parseDay(d).toLocaleDateString(intlLocale(), { weekday: 'narrow' });
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="body-trends">
      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('body.trendsKicker') }}</p>
      <h2 class="display text-2xl text-white">{{ t('body.trendsTitle') }}</h2>

      <!-- Gewicht 8 Wochen -->
      <div class="mt-4">
          <div class="flex items-baseline justify-between gap-3">
              <span class="body-tile-label">{{ t('body.weight8') }}</span>
              <span v-if="change8 != null" class="font-mono text-[11px] text-slate-300">{{ change8 > 0 ? '+' : change8 < 0 ? '−' : '±' }}{{ fmtKg(Math.abs(change8)) }} kg</span>
          </div>
          <svg v-if="chart" :viewBox="`0 0 ${W} ${H}`" class="mt-2 h-auto w-full" role="img" :aria-label="t('body.weightChart')">
              <g v-for="tk in chart.ticks" :key="tk.v">
                  <line :x1="PAD_L" :x2="W" :y1="tk.y" :y2="tk.y" class="chart-grid" />
                  <text :x="PAD_L - 6" :y="tk.y + 3" text-anchor="end" class="chart-axis">{{ fmtKg(tk.v) }}</text>
              </g>
              <text v-for="d in chart.dates" :key="d.label" :x="d.x" :y="H - 2" :text-anchor="d.anchor" class="chart-axis">{{ d.label }}</text>
              <circle v-for="d in chart.dots" :key="d.k" :cx="d.x" :cy="d.y" r="2.4" class="weight-dot" />
              <polyline :points="chart.line" class="weight-line" pathLength="1" />
          </svg>
          <p v-else class="mt-2 rounded-xl bg-white/[0.04] p-3 text-[11px] leading-snug text-slate-400">{{ t('body.weightEmpty') }}</p>
      </div>

      <!-- Eiweiß 14 Tage -->
      <div class="mt-5">
          <div class="flex items-baseline justify-between gap-3">
              <span class="body-tile-label">{{ t('body.protein14') }}</span>
              <span class="font-mono text-[11px] text-slate-300">
                  <template v-if="avg7 != null">Ø {{ avg7 }} g</template><template v-if="onTarget != null"> · {{ t('body.onTarget', { n: onTarget }) }}</template>
              </span>
          </div>
          <div class="relative mt-2 h-24">
              <!-- Zielband -->
              <div v-if="target" class="body-band absolute inset-x-0" :style="{ bottom: `${(target.min / maxG) * 100}%`, height: `${((target.max - target.min) / maxG) * 100}%` }" aria-hidden="true"></div>
              <div class="relative grid h-full grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1" role="group" :aria-label="t('body.protein14')">
                  <button v-for="d in days14" :key="d.day" type="button" class="h-full" :aria-label="`${short(d.day)}: ${d.g} g`" :aria-pressed="picked === d.day" @click="picked = picked === d.day ? null : d.day">
                      <span class="block w-full rounded-t-sm transition-[height] duration-300" :class="[target && d.g >= target.min ? 'bg-emerald-400/80' : d.g ? 'bg-accent/70' : 'bg-white/10', picked === d.day ? 'ring-2 ring-white/60' : '']" :style="{ height: `${Math.max(3, (d.g / maxG) * 100)}%` }"></span>
                  </button>
              </div>
          </div>
          <div class="mt-1 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 text-center text-[9px] font-bold uppercase text-slate-500" aria-hidden="true"><span v-for="d in days14" :key="d.day">{{ weekday(d.day) }}</span></div>
          <p v-if="pickedDay" class="mt-1 text-[11px] text-slate-300">{{ short(pickedDay.day) }}: <span class="font-mono font-bold text-white">{{ pickedDay.g }} g</span></p>
      </div>
  </section>
</template>
