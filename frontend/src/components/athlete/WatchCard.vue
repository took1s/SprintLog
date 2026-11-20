<script setup lang="ts">
// Uhr & Apple Health: Status, Verbinden/Aktualisieren, Wochenmittel (Schlaf, Ruhepuls, HRV), was wirklich ankommt -
// und eine Anleitung je Marke (Apple Watch, Xiaomi, Garmin, Huawei, Amazfit, Polar, Samsung, andere), damit jeder
// versteht, wie die Daten seiner Uhr in die App kommen: Uhr-App -> Apple Health -> SprintLog.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { useAthleteStore } from '@/stores/athlete';
import { useHealthStore } from '@/stores/health';
import { addDays } from '@/lib/routines';
import { readJson, writeJson } from '@/lib/storage';

const athlete = useAthleteStore();
const health = useHealthStore();
const { daily, today } = storeToRefs(athlete);

const BRANDS = ['apple', 'xiaomi', 'garmin', 'huawei', 'amazfit', 'polar', 'samsung', 'other'] as const;
type Brand = (typeof BRANDS)[number];
const BRAND_KEY = 'sprintlog:watchBrand';
const brand = ref<Brand | null>(readJson<Brand | null>(BRAND_KEY, null));
function pick(b: Brand) { brand.value = brand.value === b ? null : b; writeJson(BRAND_KEY, brand.value); }
/** Anleitung offen: ohne Verbindung immer, sonst auf Wunsch. */
const guideOpen = ref(!health.connected);
const supported = computed(() => brand.value !== 'samsung');

const week = computed(() => Array.from({ length: 7 }, (_, i) => daily.value.find((d) => d.day === addDays(today.value, i - 6)) ?? null));
const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const sleepAvg = computed(() => avg(week.value.map((d) => d?.sleepMinutes)));
const rhrAvg = computed(() => avg(week.value.map((d) => d?.restingHr)));
const hrvAvg = computed(() => avg(week.value.map((d) => d?.hrv)));
const hours = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const synced = computed(() => (health.lastSync ? new Date(health.lastSync).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' }) : null));
const status = computed(() => (!health.available ? 'web' : health.connected ? 'on' : 'off'));
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="health">
      <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
              <h2 class="display text-2xl text-white">{{ t('watch.title') }}</h2>
          </div>
          <span class="watch-status mt-1" :class="`is-${status}`" data-test="watch-status">{{ t(`watch.status.${status}`) }}</span>
      </div>

      <!-- Verbunden: Werte der Woche -->
      <template v-if="status === 'on'">
          <dl class="mt-4 grid grid-cols-3 gap-2 text-center">
              <div class="report-stat"><dt>{{ t('body.sleep') }}</dt><dd class="!text-base">{{ sleepAvg != null ? hours(sleepAvg) : '–' }}</dd></div>
              <div class="report-stat"><dt>{{ t('body.rhr') }}</dt><dd class="!text-base">{{ rhrAvg != null ? Math.round(rhrAvg) : '–' }}</dd></div>
              <div class="report-stat"><dt>HRV</dt><dd class="!text-base">{{ hrvAvg != null ? Math.round(hrvAvg) : '–' }}</dd></div>
          </dl>
          <div class="mt-2 flex items-center justify-between gap-2">
              <p class="text-tiny text-slate-500">{{ t('body.healthWeekAvg') }}<template v-if="synced"> · {{ t('body.healthSynced', { time: synced }) }}</template></p>
              <button type="button" class="routine-link -mr-3" :disabled="health.busy" data-test="health-sync" @click="health.sync()">{{ health.busy ? t('body.healthSyncing') : t('body.healthSync') }}</button>
          </div>
          <p v-if="health.error" class="mt-1 text-[11px] text-red-300">{{ health.error }}</p>
          <details v-if="health.report" class="mt-3 rounded-xl bg-white/[0.04] px-3 py-2" data-test="health-report">
              <summary class="cursor-pointer text-[11px] font-bold text-slate-300">{{ t('body.report.title') }}</summary>
              <ul class="mt-2 space-y-1 text-[11px] text-slate-400">
                  <li>{{ t('body.report.sleep') }}: <span class="text-slate-200">{{ t('body.report.days', { n: health.report.nights }) }}</span><template v-if="health.report.sleepInBed"> · {{ t('body.report.inBed') }}</template></li>
                  <li>{{ t('body.report.rhr') }}: <span class="text-slate-200">{{ t('body.report.days', { n: health.report.rhrDays }) }}</span><template v-if="health.report.rhrEstimated"> · {{ t('body.report.estimated') }}</template></li>
                  <li>{{ t('body.report.hrv') }}: <span class="text-slate-200">{{ t('body.report.days', { n: health.report.hrvDays }) }}</span> · {{ t('body.report.steps') }}: <span class="text-slate-200">{{ t('body.report.days', { n: health.report.stepsDays }) }}</span></li>
                  <li>{{ t('body.report.workouts') }}: <span class="text-slate-200">{{ health.report.workouts }}</span><template v-if="health.report.workouts"> · {{ t('body.report.withHr', { n: health.report.withHr }) }} · {{ t('body.report.withSpeed', { n: health.report.withSpeed }) }}</template></li>
                  <li v-if="health.report.sources.length">{{ t('body.report.sources', { list: health.report.sources.join(', ') }) }}</li>
              </ul>
              <p v-if="!health.report.nights && !health.report.rhrDays && !health.report.workouts" class="mt-2 text-[11px] text-amber-300">{{ t('body.report.empty') }}</p>
              <p v-if="health.report.workouts && !health.report.withSpeed" class="mt-2 text-[11px] leading-snug text-slate-400">{{ t('body.report.noSpeed') }}</p>
              <p v-if="health.report.rhrDays && !health.report.hrvDays" class="mt-1 text-[11px] leading-snug text-slate-400">{{ t('body.report.noHrv') }}</p>
          </details>
      </template>

      <!-- So kommen die Daten an: Uhr-App -> Apple Health -> SprintLog -->
      <div v-else class="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-bold text-slate-300" aria-hidden="true">
          <span class="watch-flow">⌚ {{ t('watch.flow.watch') }}</span><span class="text-slate-500">→</span>
          <span class="watch-flow">♥ Apple Health</span><span class="text-slate-500">→</span>
          <span class="watch-flow is-app">SprintLog</span>
      </div>
      <p v-if="status === 'web'" class="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-snug text-amber-200" data-test="watch-web">{{ t('watch.webOnly') }}</p>

      <!-- Anleitung je Marke -->
      <button type="button" class="mt-3 flex w-full items-center justify-between rounded-xl px-1 py-2 text-left text-sm font-bold text-white" :aria-expanded="guideOpen" data-test="watch-guide-toggle" @click="guideOpen = !guideOpen">
          {{ t('watch.howTo') }}
          <svg class="h-4 w-4 text-slate-400 transition-transform" :class="{ 'rotate-90': guideOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
      </button>
      <transition name="expand">
          <div v-if="guideOpen" class="expand-wrap" data-test="watch-guide">
              <p class="text-[11px] text-slate-400">{{ t('watch.pickBrand') }}</p>
              <div class="mt-2 grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-4" role="radiogroup" :aria-label="t('watch.pickBrand')">
                  <button v-for="b in BRANDS" :key="b" type="button" role="radio" :aria-checked="brand === b" class="td-choice !px-2 !py-2 text-center text-xs font-bold" :class="{ 'is-on': brand === b }" :data-brand="b" @click="pick(b)">{{ t(`watch.brands.${b}.name`) }}</button>
              </div>
              <ol v-if="brand" class="watch-steps mt-3" data-test="watch-steps">
                  <li v-for="k in (['s1', 's2', 's3'] as const)" :key="k">{{ t(`watch.brands.${brand}.${k}`) }}</li>
                  <template v-if="supported">
                      <li>{{ status === 'web' ? t('watch.stepAppWeb') : t('watch.stepApp') }}</li>
                      <li>{{ t('watch.stepCheck') }}</li>
                  </template>
              </ol>
              <p v-if="brand && t(`watch.brands.${brand}.note`)" class="mt-2 text-[11px] leading-snug text-slate-400">{{ t(`watch.brands.${brand}.note`) }}</p>
          </div>
      </transition>

      <button v-if="status === 'off'" type="button" class="btn-primary mt-3 h-12 w-full rounded-xl text-sm" data-test="health-connect" @click="health.connect()">♥ {{ t('watch.connect') }}</button>
      <p v-if="status === 'off'" class="mt-2 text-tiny leading-snug text-slate-500">{{ t('body.healthHint') }}</p>
  </section>
</template>
