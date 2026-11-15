<script setup lang="ts">
// Ein Test mit Versuchen: Anleitung + Aufbau, Liste der Versuche (bester markiert), Eingabe per Lichtschranke/App
// oder Stoppuhr (Handzeit wird korrigiert). Nach jedem Versuch startet der Spieler-Container die Pause.
import { computed, ref } from 'vue';
import { intlLocale, t } from '@/i18n';
import { TESTS, formatValue, type TestId } from '@/lib/fitnessTests';
import { BLOCKS, attemptError, bestOf, cmFromFlightMs, correctHand, isBest, sideFor, type Attempt, type BlockId, type Timing } from '@/lib/testDay';
import DecimalInput from '@/components/DecimalInput.vue';
import TestDayStopwatch from './TestDayStopwatch.vue';
import TestLayout from './TestLayout.vue';

const props = defineProps<{ block: BlockId; timing: Timing; attempts: Attempt[] }>();
const emit = defineEmits<{ (e: 'save', a: Attempt): void; (e: 'remove', index: number): void; (e: 'next'): void; (e: 'skip'): void }>();

const def = computed(() => BLOCKS[props.block]);
const planned = computed(() => def.value.attempts);
const n = computed(() => props.attempts.length);
const extra = ref(false);
const inputOpen = computed(() => n.value < planned.value || extra.value);
const side = computed(() => sideFor(props.block, n.value));
const useStopwatch = computed(() => props.timing === 'stopwatch' && (props.block === 'sprint' || props.block === 'agility'));
const showHow = ref(n.value === 0);

const values = ref<Partial<Record<TestId, number | null>>>({});
const cmjMode = ref<'cm' | 'ms'>('cm');
const flightMs = ref<number | null>(null);
const shownError = ref<string | null>(null);

const best = computed(() => bestOf(props.attempts, def.value.tests));
const fmt = (id: TestId, v: number) => formatValue(id, v, intlLocale());
const unit = (id: TestId) => t(`tests.units.${TESTS[id].unit}`);
const testLabel = (id: TestId) => (props.block === 'sprint' ? (id === 'sprint10' ? '10 m' : '30 m') : unit(id));

function push(vals: Partial<Record<TestId, number>>, raw?: Partial<Record<TestId, number>>) {
  emit('save', { values: vals, raw, side: side.value, at: Date.now() });
  values.value = {};
  flightMs.value = null;
  shownError.value = null;
  extra.value = false;
  showHow.value = false;
}

function saveTyped() {
  const v: Partial<Record<TestId, number | null>> = { ...values.value };
  if (props.block === 'cmj' && cmjMode.value === 'ms') v.cmj = flightMs.value != null ? cmFromFlightMs(flightMs.value) : null;
  const err = attemptError(props.block, v);
  if (err) { shownError.value = t(`testDay.errors.${err}`); return; }
  push(Object.fromEntries(Object.entries(v).filter(([, x]) => x != null)) as Partial<Record<TestId, number>>);
}

function fromStopwatch(r: { split: number | null; total: number }) {
  const raw: Partial<Record<TestId, number>> = props.block === 'sprint'
    ? { sprint30: r.total, ...(r.split != null ? { sprint10: r.split } : {}) }
    : { agility: r.total };
  const vals = Object.fromEntries(Object.entries(raw).map(([k, x]) => [k, correctHand(x!)])) as Partial<Record<TestId, number>>;
  const err = attemptError(props.block, vals);
  if (err) { shownError.value = t(`testDay.errors.${err}`); return; }
  push(vals, raw);
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden" :data-test="`test-block-${block}`">
      <div class="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <p class="player-kind is-work" data-test="attempt-label">
              <template v-if="inputOpen">{{ n < planned ? t('testDay.attempt', { n: n + 1, total: planned }) : t('testDay.attemptExtra', { n: n + 1 }) }}<template v-if="side"> · {{ t(`testDay.side.${side}`) }}</template></template>
              <template v-else>{{ t('testDay.blockDone') }}</template>
          </p>
          <h2 class="display mt-1 text-3xl leading-tight text-white">{{ t(`testDay.blocks.${block}`) }}</h2>

          <!-- Anleitung und Aufbau -->
          <button type="button" class="routine-link mt-2" :aria-expanded="showHow" data-test="attempt-how" @click="showHow = !showHow">{{ t('testDay.howTo') }} {{ showHow ? '▴' : '▾' }}</button>
          <transition name="expand">
              <div v-if="showHow" class="expand-wrap">
                  <div class="mt-2 rounded-2xl bg-white/[0.04] p-3">
                      <TestLayout :block="block" />
                      <p class="mt-2 text-xs leading-relaxed text-slate-300">{{ t(`testDay.protocol.${block}`) }}</p>
                  </div>
              </div>
          </transition>

          <!-- Versuche -->
          <ol v-if="attempts.length" class="mt-4 space-y-1.5" data-test="attempt-list">
              <li v-for="(a, i) in attempts" :key="a.at" class="flex items-center gap-3 rounded-xl border px-3 py-2"
                  :class="isBest(a, attempts, def.tests) ? 'border-[var(--accent-ring)] bg-white/[0.06]' : 'border-white/10 bg-white/[0.02]'">
                  <span class="w-5 font-mono text-xs text-slate-400">{{ i + 1 }}</span>
                  <span class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 font-mono text-sm text-white">
                      <span v-for="id in def.tests.filter((x) => a.values[x] != null)" :key="id">
                          <span v-if="def.tests.length > 1" class="mr-1 text-[10px] text-slate-400">{{ testLabel(id) }}</span>{{ fmt(id, a.values[id]!) }}<span class="ml-0.5 text-[11px] text-slate-400">{{ unit(id) }}</span>
                      </span>
                      <span v-if="a.side" class="text-[10px] text-slate-400">{{ t(`testDay.sideShort.${a.side}`) }}</span>
                  </span>
                  <span v-if="isBest(a, attempts, def.tests)" class="text-[10px] font-bold uppercase tracking-label text-accent">{{ t('testDay.best') }}</span>
                  <button type="button" class="h-8 w-8 flex-shrink-0 rounded-lg text-slate-500 hover:text-red-300" :aria-label="t('testDay.removeAttempt', { n: i + 1 })" data-test="attempt-remove" @click="emit('remove', i)">✕</button>
              </li>
          </ol>

          <!-- Eingabe -->
          <div v-if="inputOpen" class="mt-4">
              <TestDayStopwatch v-if="useStopwatch" :with-split="block === 'sprint'" @result="fromStopwatch" />
              <form v-else class="space-y-3" @submit.prevent="saveTyped">
                  <div v-if="block === 'cmj'" class="flex gap-1 rounded-xl bg-white/5 p-1" role="radiogroup" :aria-label="t('testDay.cmjMode.label')">
                      <button v-for="m in (['cm', 'ms'] as const)" :key="m" type="button" role="radio" class="flex-1 rounded-lg py-2 text-xs font-bold transition-colors" :class="cmjMode === m ? 'bg-surface text-white shadow-sm' : 'text-slate-400'" :aria-checked="cmjMode === m" @click="cmjMode = m">{{ t(`testDay.cmjMode.${m}`) }}</button>
                  </div>
                  <div v-if="block === 'cmj' && cmjMode === 'ms'" class="flex items-center gap-3">
                      <label for="td-flight" class="min-w-0 flex-1 text-sm font-bold text-white">{{ t('testDay.cmjMode.ms') }}</label>
                      <DecimalInput id="td-flight" v-model="flightMs" integer class="field h-14 w-28 rounded-xl px-2 text-center font-mono text-lg" />
                      <span class="w-14 text-xs text-slate-400">{{ flightMs ? `= ${cmFromFlightMs(flightMs)} cm` : 'ms' }}</span>
                  </div>
                  <template v-else>
                      <div v-for="id in def.tests" :key="id" class="flex items-center gap-3">
                          <label :for="`td-${id}`" class="min-w-0 flex-1 text-sm font-bold text-white">{{ t(`tests.names.${id}`) }}</label>
                          <DecimalInput :id="`td-${id}`" v-model="values[id]" :integer="TESTS[id].decimals === 0" class="field h-14 w-28 rounded-xl px-2 text-center font-mono text-lg" :data-attempt-input="id" />
                          <span class="w-14 text-xs font-bold text-slate-400">{{ unit(id) }}</span>
                      </div>
                  </template>
                  <button type="submit" class="btn-primary h-14 w-full rounded-2xl text-base" data-test="attempt-save">✓ {{ t('testDay.saveAttempt') }}</button>
              </form>
              <p v-if="shownError" class="mt-2 text-xs text-red-300" role="alert">{{ shownError }}</p>
              <p v-if="useStopwatch" class="mt-2 text-[11px] leading-snug text-slate-500">{{ t('testDay.stopwatch.correction') }}</p>
          </div>

          <!-- Test fertig -->
          <div v-else class="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center" data-test="block-done">
              <p class="text-xs font-bold uppercase tracking-label text-slate-400">{{ t('testDay.bestResult') }}</p>
              <p class="mt-1 font-mono text-2xl font-black text-white">
                  <span v-for="id in def.tests.filter((x) => best[x] != null)" :key="id" class="mx-2 inline-block">
                      <span v-if="def.tests.length > 1" class="mr-1 text-xs text-slate-400">{{ testLabel(id) }}</span>{{ fmt(id, best[id]!) }}<span class="ml-0.5 text-sm text-slate-400">{{ unit(id) }}</span>
                  </span>
              </p>
              <button type="button" class="routine-link mt-2" data-test="attempt-more" @click="extra = true">+ {{ t('testDay.moreAttempt') }}</button>
          </div>
      </div>
      <footer class="px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
          <button v-if="!attempts.length" type="button" class="btn-secondary h-12 w-full rounded-2xl text-sm" data-test="block-skip" @click="emit('skip')">{{ t('testDay.skipTest') }}</button>
          <button v-else type="button" :class="inputOpen ? 'btn-secondary h-12 text-sm' : 'btn-primary h-14 text-base'" class="w-full rounded-2xl" data-test="block-next" @click="emit('next')">{{ t('testDay.nextTest') }} →</button>
      </footer>
  </div>
</template>
