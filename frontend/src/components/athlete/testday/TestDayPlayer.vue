<script setup lang="ts">
// Geführter Testtag (Vollbild): Vorbereitung -> Aufwärmen mit Timer -> Tests der Reihe nach mit Versuchen und Pausen ->
// Ausdauertest mit eigenem Takt -> Zusammenfassung. Alles liegt im Athleten-Store und wird lokal gespeichert:
// Schließen/Neuladen setzt genau dort fort (Pausen laufen über Zeitstempel weiter).
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useAthleteStore } from '@/stores/athlete';
import { BEFORE_ENDURANCE, BETWEEN_BLOCKS, BLOCKS, sideFor, warmupFor, type Attempt, type BlockId, type Endurance, type Timing } from '@/lib/testDay';
import { createWakeLock, playRestAlarm, unlockAudio } from '@/lib/feedback';
import { createSignalScheduler } from '@/lib/signals';
import { isNative, scheduleRestNotification, setKeepAwake, tap as haptic } from '@/lib/native';
import TestDaySetup from './TestDaySetup.vue';
import TestDayWarmup from './TestDayWarmup.vue';
import TestDayAttempts from './TestDayAttempts.vue';
import TestDayEndurance from './TestDayEndurance.vue';
import TestDaySummary from './TestDaySummary.vue';
import TestDayRest from './TestDayRest.vue';

const app = useAppStore();
const athlete = useAthleteStore();
const { testDay: s, testDayOpen } = storeToRefs(athlete);
const { settings } = storeToRefs(app);

const now = ref(Date.now());
const block = computed<BlockId | null>(() => (s.value?.stage === 'block' ? s.value.blocks[s.value.block] ?? null : null));
const resting = computed(() => !!s.value?.restUntil && s.value.restUntil > now.value);

/** Fortschritt: Aufwärmen + jeder Test ein Abschnitt. */
const steps = computed(() => {
  if (!s.value) return [];
  const list: { id: string; label: string; state: 'done' | 'now' | 'next' }[] = [];
  const warm = warmupFor(s.value.blocks).length > 0;
  const stageIdx = s.value.stage === 'warmup' ? 0 : s.value.stage === 'block' ? 1 + s.value.block : 1 + s.value.blocks.length;
  if (warm) list.push({ id: 'warmup', label: t('testDay.steps.warmup'), state: stageIdx === 0 ? 'now' : 'done' });
  s.value.blocks.forEach((b, i) => list.push({ id: b, label: t(`testDay.blocks.${b}`), state: stageIdx === 1 + i ? 'now' : stageIdx > 1 + i ? 'done' : 'next' }));
  return list;
});

// ---------- Takt, Pausen-Signal, Bildschirm wach ----------

const signal = createSignalScheduler();
const wake = createWakeLock();
let ticker = 0;

function loop() {
  now.value = Date.now();
  const cur = s.value;
  if (!cur?.restUntil) return;
  const left = Math.ceil((cur.restUntil - now.value) / 1000);
  if (left <= 0) {
    // Pause vorbei: Signal, dann weiter (Versuch bzw. nächster Test)
    athlete.patchTestDay({ restUntil: null, restKind: null });
    playRestAlarm({ sound: settings.value.sound, vibration: settings.value.vibration });
    signal.signalled();
    return;
  }
}

watch(() => s.value?.restUntil ?? null, (end) => {
  signal.plan(end && end > Date.now() ? end : null, { sound: settings.value.sound, duck: settings.value.duckMusic, countdown: settings.value.countdown });
  // iPhone in der Tasche: Mitteilung am Ende der Pause
  void scheduleRestNotification(end && end > Date.now() ? end : null, { title: t('testDay.title'), body: t('testDay.restOver') });
}, { immediate: true });

async function keepAwake(on: boolean) {
  if (isNative()) await setKeepAwake(on).catch(() => undefined);
  else await wake.set(on);
}

watch(testDayOpen, (open) => {
  window.clearInterval(ticker);
  if (open) { now.value = Date.now(); ticker = window.setInterval(loop, 250); void keepAwake(true); }
  else { void keepAwake(false); }
}, { immediate: true });

onBeforeUnmount(() => { window.clearInterval(ticker); signal.dispose(); void keepAwake(false); });

// ---------- Ablauf ----------

function start(blocks: BlockId[], timing: Timing, warmup: boolean) {
  unlockAudio();
  athlete.startTestDay(blocks, timing, warmup && warmupFor(blocks).length > 0);
}

function warmupDone() {
  athlete.patchTestDay({ stage: 'block', block: 0, stepEndsAt: null });
}

function rest(seconds: number, kind: 'attempt' | 'block') {
  athlete.patchTestDay({ restUntil: Date.now() + seconds * 1000, restKind: kind });
}

function saveAttempt(a: Attempt) {
  const cur = s.value;
  const b = block.value;
  if (!cur || !b) return;
  const list = [...(cur.attempts[b] ?? []), a];
  athlete.patchTestDay({ attempts: { ...cur.attempts, [b]: list } });
  haptic();
  // Pause nach jedem Versuch, außer nach dem letzten geplanten
  if (list.length < BLOCKS[b].attempts) rest(BLOCKS[b].rest, 'attempt');
}

function removeAttempt(index: number) {
  const cur = s.value;
  const b = block.value;
  if (!cur || !b) return;
  athlete.patchTestDay({ attempts: { ...cur.attempts, [b]: (cur.attempts[b] ?? []).filter((_, i) => i !== index) } });
}

function nextBlock(skip = false) {
  const cur = s.value;
  const b = block.value;
  if (!cur || !b) return;
  const skipped = skip ? [...cur.skipped.filter((x) => x !== b), b] : cur.skipped.filter((x) => x !== b);
  const i = cur.block + 1;
  if (i >= cur.blocks.length) { athlete.patchTestDay({ skipped, stage: 'summary', restUntil: null, restKind: null }); return; }
  const upcoming = cur.blocks[i]!;
  athlete.patchTestDay({ skipped, block: i, restUntil: skip ? null : Date.now() + (BLOCKS[upcoming].kind === 'endurance' ? BEFORE_ENDURANCE : BETWEEN_BLOCKS) * 1000, restKind: skip ? null : 'block' });
}

function setEndurance(kind: Endurance, patch: Partial<{ running: boolean; result: number | null; warnings: number }>) {
  const cur = s.value;
  if (!cur) return;
  const prev = cur.endurance[kind] ?? { running: false, result: null, warnings: 0 };
  athlete.patchTestDay({ endurance: { ...cur.endurance, [kind]: { ...prev, ...patch } } });
}

function skipRest() { athlete.patchTestDay({ restUntil: null, restKind: null }); haptic(); }
function addRest(seconds: number) { if (s.value?.restUntil) athlete.patchTestDay({ restUntil: s.value.restUntil + seconds * 1000 }); }

/** Was nach der Pause kommt (Anzeige). */
const restNext = computed(() => {
  const cur = s.value;
  const b = block.value;
  if (!cur || !b) return '';
  if (cur.restKind === 'block') return t(`testDay.blocks.${b}`);
  const n = (cur.attempts[b]?.length ?? 0);
  const side = sideFor(b, n);
  return `${t('testDay.attempt', { n: n + 1, total: Math.max(BLOCKS[b].attempts, n + 1) })}${side ? ` · ${t(`testDay.side.${side}`)}` : ''}`;
});

function toSummary() { athlete.patchTestDay({ stage: 'summary', restUntil: null, restKind: null }); }
function backToTests() { if (s.value) athlete.patchTestDay({ stage: 'block', block: Math.max(0, s.value.blocks.length - 1) }); }
</script>

<template>
  <transition name="fade">
      <div v-if="testDayOpen" class="routine-player fixed inset-0 z-[80] flex flex-col" role="dialog" aria-modal="true" :aria-label="t('testDay.title')" data-test="test-day" @keydown.esc.stop="athlete.closeTestDay()">
          <header class="flex items-center gap-3 px-5 pb-2" :style="{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }">
              <button type="button" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white" :aria-label="t('testDay.minimize')" data-test="test-day-close" @click="athlete.closeTestDay()">
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
              </button>
              <div class="min-w-0 flex-1">
                  <p class="truncate text-[10px] font-bold uppercase tracking-label text-accent">{{ t('testDay.title') }}</p>
                  <ol v-if="steps.length" class="mt-1 flex gap-1" :aria-label="t('testDay.progress')">
                      <li v-for="st in steps" :key="st.id" class="td-step" :class="`is-${st.state}`" :title="st.label"><span class="sr-only">{{ st.label }}</span></li>
                  </ol>
              </div>
              <button v-if="s && s.stage !== 'summary'" type="button" class="flex-shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:text-white" data-test="test-day-end" @click="toSummary">{{ t('testDay.endEarly') }}</button>
          </header>

          <TestDaySetup v-if="!s" @start="start" />
          <TestDayWarmup v-else-if="s.stage === 'warmup'" :session="s" @patch="athlete.patchTestDay" @done="warmupDone" />
          <template v-else-if="s.stage === 'block' && block">
              <TestDayRest v-if="resting" :until="s.restUntil!" :now="now" :kind="s.restKind ?? 'attempt'" :next="restNext" @skip="skipRest" @add="addRest" />
              <TestDayEndurance v-else-if="BLOCKS[block].kind === 'endurance'" :key="block" :kind="block as Endurance" :state="s.endurance[block as Endurance] ?? null"
                                @patch="(p) => setEndurance(block as Endurance, p)" @next="nextBlock(false)" @skip="nextBlock(true)" />
              <TestDayAttempts v-else :key="block" :block="block" :timing="s.timing" :attempts="s.attempts[block] ?? []"
                               @save="saveAttempt" @remove="removeAttempt" @next="nextBlock(false)" @skip="nextBlock(true)" />
          </template>
          <TestDaySummary v-else-if="s.stage === 'summary'" :session="s" @back="backToTests" />
      </div>
  </transition>
</template>
