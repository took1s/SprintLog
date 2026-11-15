<script setup lang="ts">
// Körper und Ernährung: Gewicht mit 7-Tage-Trend, Eiweiß heute (Schnellknöpfe) gegen das Ziel 1,6-2,2 g/kg,
// Apple Health (Schlaf, Ruhepuls, HRV) - in der iPhone-App automatisch, im Browser mit Hinweis.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { useAthleteStore, weightTrend } from '@/stores/athlete';
import { useHealthStore } from '@/stores/health';
import { addDays, parseDay } from '@/lib/routines';
import DecimalInput from '@/components/DecimalInput.vue';

const athlete = useAthleteStore();
const health = useHealthStore();
const { daily, today, todayLog, latestWeight, protein } = storeToRefs(athlete);

const weightInput = ref<number | null>(null);
function saveWeight() {
  if (weightInput.value == null || weightInput.value < 30 || weightInput.value > 250) return;
  athlete.setDaily(today.value, { weightKg: Math.round(weightInput.value * 10) / 10 });
  weightInput.value = null;
}

const trend = computed(() => weightTrend(daily.value, today.value, 56));
const avgNow = computed(() => trend.value[trend.value.length - 1]?.avg ?? null);
const avgThen = computed(() => trend.value[trend.value.length - 29]?.avg ?? null);
const change = computed(() => (avgNow.value != null && avgThen.value != null ? Math.round((avgNow.value - avgThen.value) * 10) / 10 : null));
const chart = computed(() => {
  const pts = trend.value;
  const vals = pts.flatMap((p) => [p.value, p.avg]).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const x = (i: number) => (i / (pts.length - 1)) * 300;
  const y = (v: number) => 70 - ((v - min) / (max - min)) * 64;
  return {
    dots: pts.map((p, i) => (p.value == null ? null : { x: x(i), y: y(p.value), k: i })).filter(Boolean) as { x: number; y: number; k: number }[],
    line: pts.map((p, i) => (p.avg == null ? null : `${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`)).filter(Boolean).join(' '),
    min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10,
  };
});

const proteinPct = computed(() => (protein.value.target ? Math.min(100, Math.round((protein.value.today / protein.value.target.goal) * 100)) : 0));
const week = computed(() => Array.from({ length: 7 }, (_, i) => {
  const day = addDays(today.value, i - 6);
  const log = daily.value.find((d) => d.day === day);
  return { day, protein: log?.proteinG ?? 0, sleep: log?.sleepMinutes ?? null, rhr: log?.restingHr ?? null, hrv: log?.hrv ?? null };
}));
const maxProtein = computed(() => Math.max(protein.value.target?.max ?? 0, ...week.value.map((d) => d.protein), 1));
const weekday = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'narrow' });
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const sleepAvg = computed(() => avg(week.value.map((d) => d.sleep)));
const rhrAvg = computed(() => avg(week.value.map((d) => d.rhr)));
const hrvAvg = computed(() => avg(week.value.map((d) => d.hrv)));
const hours = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const synced = computed(() => (health.lastSync ? new Date(health.lastSync).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }) : null));
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="body-card">
      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('body.kicker') }}</p>
      <h2 class="display text-2xl text-white">{{ t('body.title') }}</h2>

      <!-- Eiweiß heute -->
      <div class="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-test="protein">
          <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-bold text-white">{{ t('body.protein') }}</span>
              <span class="font-mono text-xs text-slate-400"><span class="text-lg font-black text-white" data-test="protein-today">{{ protein.today }}</span><template v-if="protein.target"> / {{ protein.target.goal }}</template> g</span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="proteinPct" aria-valuemin="0" aria-valuemax="100" :aria-label="t('body.protein')">
              <div class="h-full rounded-full transition-all duration-500" :class="proteinPct >= 100 ? 'bg-emerald-400' : 'bg-accent'" :style="{ width: Math.max(2, proteinPct) + '%' }"></div>
          </div>
          <div class="mt-3 grid grid-cols-4 gap-2">
              <button v-for="g in [20, 30, 40]" :key="g" type="button" class="protein-btn" :data-protein="g" @click="athlete.addProtein(g)">+{{ g }} g</button>
              <button type="button" class="protein-btn is-minus" :aria-label="t('body.proteinMinus')" :disabled="!protein.today" @click="athlete.addProtein(-10)">−10</button>
          </div>
          <p class="mt-2 text-[11px] leading-snug text-slate-400">{{ protein.target ? t('body.proteinTarget', { min: protein.target.min, max: protein.target.max }) : t('body.proteinNoWeight') }}</p>
          <div class="mt-3 grid h-11 grid-cols-7 items-end gap-1.5" role="img" :aria-label="t('body.proteinWeek')">
              <span v-for="d in week" :key="d.day" class="rounded-t bg-accent/70" :class="{ 'bg-emerald-400/80': protein.target && d.protein >= protein.target.min }" :style="{ height: `${Math.max(4, (d.protein / maxProtein) * 100)}%` }"></span>
          </div>
          <div class="mt-1 grid grid-cols-7 text-center text-[9px] font-bold uppercase text-slate-500"><span v-for="d in week" :key="d.day">{{ weekday(d.day) }}</span></div>
      </div>

      <!-- Gewicht -->
      <div class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-test="weight">
          <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-bold text-white">{{ t('body.weight') }}</span>
              <span class="font-mono text-xs text-slate-400">
                  <span class="text-lg font-black text-white" data-test="weight-latest">{{ latestWeight ?? '–' }}</span> kg
                  <span v-if="change != null && change !== 0" class="ml-1" :class="change < 0 ? 'text-sky-300' : 'text-amber-300'">{{ change > 0 ? '+' : '' }}{{ change }} kg / 4 {{ t('body.weeks') }}</span>
              </span>
          </div>
          <svg v-if="chart" viewBox="0 0 300 74" class="mt-2 h-20 w-full" role="img" :aria-label="t('body.weightChart')">
              <circle v-for="d in chart.dots" :key="d.k" :cx="d.x" :cy="d.y" r="2.5" class="weight-dot" />
              <polyline :points="chart.line" class="weight-line" pathLength="1" />
          </svg>
          <p v-else class="mt-2 text-[11px] text-slate-500">{{ t('body.weightEmpty') }}</p>
          <form class="mt-3 flex items-center gap-2" @submit.prevent="saveWeight">
              <DecimalInput v-model="weightInput" class="field h-11 min-w-0 flex-1 rounded-xl px-3 font-mono" :placeholder="todayLog?.weightKg ? String(todayLog.weightKg) : t('body.weightPlaceholder')" :aria-label="t('body.weightToday')" data-test="weight-input" />
              <button type="submit" class="btn-secondary h-11 flex-shrink-0 rounded-xl px-4 text-sm" :disabled="weightInput == null" data-test="weight-save">{{ t('common.save') }}</button>
          </form>
          <p class="mt-1.5 text-[10px] text-slate-500">{{ t('body.weightHint') }}</p>
      </div>

      <!-- Apple Health -->
      <div class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-test="health">
          <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-sm font-bold text-white">
                  <svg class="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8.2 3.3 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.7 5 21 8.2 19.5 11.7 17.5 16.4 12 21 12 21z"/></svg>
                  Apple Health
              </span>
              <button v-if="health.available && !health.connected" type="button" class="btn-primary flex-shrink-0 rounded-xl px-3 py-2 text-xs" data-test="health-connect" @click="health.connect()">{{ t('body.healthConnect') }}</button>
              <button v-else-if="health.available" type="button" class="flex-shrink-0 text-xs font-bold text-accent disabled:opacity-50" :disabled="health.busy" @click="health.sync()">{{ health.busy ? t('body.healthSyncing') : t('body.healthSync') }}</button>
          </div>
          <p v-if="!health.available" class="mt-1.5 text-[11px] leading-snug text-slate-400">{{ t('body.healthWeb') }}</p>
          <p v-else-if="!health.connected" class="mt-1.5 text-[11px] leading-snug text-slate-400">{{ t('body.healthHint') }}</p>
          <template v-else>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div class="report-stat"><dt>{{ t('body.sleep') }}</dt><dd class="!text-base">{{ sleepAvg != null ? hours(sleepAvg) : '–' }}</dd></div>
                  <div class="report-stat"><dt>{{ t('body.rhr') }}</dt><dd class="!text-base">{{ rhrAvg != null ? Math.round(rhrAvg) : '–' }}</dd></div>
                  <div class="report-stat"><dt>HRV</dt><dd class="!text-base">{{ hrvAvg != null ? Math.round(hrvAvg) : '–' }}</dd></div>
              </dl>
              <p class="mt-2 text-[10px] text-slate-500">{{ t('body.healthWeekAvg') }}<template v-if="synced"> · {{ t('body.healthSynced', { time: synced }) }}</template></p>
              <p v-if="health.error" class="mt-1 text-[11px] text-red-300">{{ health.error }}</p>
          </template>
      </div>
  </section>
</template>
