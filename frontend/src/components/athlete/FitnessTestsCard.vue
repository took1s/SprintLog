<script setup lang="ts">
// Leistungstests: je Test letzter Wert, Veränderung, Niveau-Skala (Amateur -> Elite) für die eigene Position,
// Abstand zur nächsten Stufe und Verlauf. Kopf: wann zuletzt getestet, wann wieder fällig, "Neuer Test".
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { useAthleteStore } from '@/stores/athlete';
import { useAiStore } from '@/stores/ai';
import { LEVELS, TESTS, TEST_IDS, formatValue, history, rate, thresholds, type Position, type TestId } from '@/lib/fitnessTests';
import { parseDay } from '@/lib/routines';

const athlete = useAthleteStore();
const ai = useAiStore();
const { tests, due, testDay } = storeToRefs(athlete);

const position = computed(() => (ai.profile.position as Position | null) ?? null);
const open = ref<TestId | null>(null);
const date = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' });
const unit = (id: TestId) => t(`tests.units.${TESTS[id].unit}`);
const fmt = (id: TestId, v: number) => formatValue(id, v, intlLocale());

const rows = computed(() => TEST_IDS.map((id) => {
  const h = history(tests.value, id);
  return { id, h, rating: h.last ? rate(id, h.last.value, position.value) : null, th: thresholds(id, position.value) };
}));

/** Kleiner Verlauf: Punkte der letzten Ergebnisse (besser = höher). */
function spark(id: TestId) {
  const list = rows.value.find((r) => r.id === id)!.h.list.slice(-8);
  if (list.length < 2) return null;
  const vals = list.map((r) => (TESTS[id].lowerIsBetter ? -r.value : r.value));
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  return list.map((_, i) => `${(8 + (i / (list.length - 1)) * 284).toFixed(1)},${(36 - ((vals[i]! - min) / span) * 30).toFixed(1)}`).join(' ');
}
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="tests-card">
      <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-[12rem] flex-1">
              <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('tests.kicker') }}</p>
              <h2 class="display text-2xl text-white">{{ t('tests.title') }}</h2>
              <p class="mt-1 text-xs leading-snug" :class="due.state === 'overdue' || due.state === 'due' ? 'text-amber-300' : 'text-slate-400'" data-test="tests-due">
                  <template v-if="due.state === 'none'">{{ t('tests.none') }}</template>
                  <template v-else-if="due.state === 'ok'">{{ t('tests.lastOk', { date: date(due.lastDay!), next: date(due.nextDay!) }) }}</template>
                  <template v-else>{{ t('tests.retest', { n: due.days! }) }}</template>
              </p>
          </div>
      </div>
      <!-- Geführter Testtag (Hauptweg) und schnelles Eintragen fertiger Werte -->
      <div class="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" class="btn-primary flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-4 text-sm" data-test="tests-day" @click="athlete.openTestDay()">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>
              {{ testDay ? t('testDay.resume') : t('testDay.cta') }}
          </button>
          <button type="button" class="btn-secondary min-h-[3rem] rounded-xl px-4 text-xs" data-test="tests-new" @click="athlete.openTests()">+ {{ t('tests.new') }}</button>
      </div>

      <button v-if="!position" type="button" class="mt-3 w-full rounded-xl border border-dashed border-white/15 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5" @click="ai.openProfile()">
          {{ t('tests.setPosition') }} →
      </button>

      <!-- Legende der Stufen (einmal statt unter jedem Balken) -->
      <div class="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase text-slate-400" aria-hidden="true">
          <span v-for="l in LEVELS" :key="l" class="flex items-center gap-1"><i class="level-seg inline-block h-2 w-3" :class="`is-${l}`"></i>{{ t(`tests.levels.${l}`) }}</span>
      </div>
      <ul class="mt-2 space-y-2">
          <li v-for="r in rows" :key="r.id" class="test-row" :class="{ 'is-open': open === r.id }" :data-test-id="r.id">
              <button type="button" class="flex w-full items-center gap-3 p-3 text-left" :aria-expanded="open === r.id" @click="open = open === r.id ? null : r.id">
                  <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold text-white">{{ t(`tests.names.${r.id}`) }}</span>
                      <span v-if="r.h.last" class="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] text-slate-400">
                          <span class="text-base font-black text-white" data-test="test-value">{{ fmt(r.id, r.h.last.value) }}<span class="ml-0.5 text-[11px] font-bold text-slate-400">{{ unit(r.id) }}</span></span>
                          <span v-if="r.h.change != null && r.h.change !== 0" :class="r.h.change > 0 ? 'text-emerald-300' : 'text-amber-300'">{{ r.h.change > 0 ? '↑' : '↓' }}{{ fmt(r.id, Math.abs(r.h.change)) }}</span>
                          <span>{{ date(r.h.last.day) }}</span>
                      </span>
                      <span v-else class="mt-0.5 block text-[11px] text-slate-500">{{ t('tests.noResult') }}</span>
                  </span>
                  <span v-if="r.rating" class="level-chip" :class="`is-${r.rating.level}`">{{ t(`tests.levels.${r.rating.level}`) }}</span>
              </button>
              <!-- Niveau-Skala: Amateur, Semi, Profi, Elite; Marker = eigener Wert -->
              <div v-if="r.rating" class="px-3 pb-3">
                  <div class="level-bar" role="img" :aria-label="`${t(`tests.levels.${r.rating.level}`)} · ${r.rating.score}/100`">
                      <span v-for="l in LEVELS" :key="l" class="level-seg" :class="`is-${l}`"></span>
                      <span class="level-marker" :style="{ left: `${r.rating.score}%` }"></span>
                  </div>
                  <div class="mt-1 grid grid-cols-4 font-mono text-[10px] text-slate-500">
                      <span v-for="(l, i) in LEVELS" :key="l" class="truncate pr-0.5 text-right">{{ fmt(r.id, r.th[i]!) }}</span>
                  </div>
                  <p v-if="r.rating.next" class="mt-1.5 text-[11px] text-slate-300">{{ t('tests.toNext', { level: t(`tests.levels.${r.rating.next}`), gap: fmt(r.id, r.rating.gap!), unit: unit(r.id) }) }}</p>
              </div>
              <transition name="expand">
                  <div v-if="open === r.id" class="expand-wrap">
                      <div class="px-3 pb-3">
                          <svg v-if="spark(r.id)" viewBox="0 0 300 42" class="mb-2 h-auto w-full" role="img" :aria-label="t('tests.trend')">
                              <polyline :points="spark(r.id)!" pathLength="1" class="test-spark" />
                              <circle v-for="(pt, k) in spark(r.id)!.split(' ')" :key="k" :cx="pt.split(',')[0]" :cy="pt.split(',')[1]" r="4" class="test-spark-dot" />
                          </svg>
                          <p class="rounded-xl bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-slate-300">{{ t(`tests.how.${r.id}`) }}</p>
                          <ul v-if="r.h.list.length" class="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
                              <li v-for="x in [...r.h.list].reverse().slice(0, 6)" :key="x.clientId" class="flex items-center justify-between gap-2">
                                  <span>{{ date(x.day) }}</span>
                                  <span class="flex items-center gap-2"><span class="text-slate-200">{{ fmt(r.id, x.value) }} {{ unit(r.id) }}</span>
                                      <button type="button" class="h-8 w-8 rounded-lg text-slate-500 hover:text-red-300" :aria-label="t('common.delete')" @click="athlete.removeResult(x.clientId)">✕</button></span>
                              </li>
                          </ul>
                          <button type="button" class="routine-link mt-2" @click="athlete.openTests(r.id)">{{ t('tests.addThis') }}</button>
                      </div>
                  </div>
              </transition>
          </li>
      </ul>
      <p class="mt-3 text-[10px] leading-relaxed text-slate-500">{{ t('tests.source') }}</p>
  </section>
</template>
