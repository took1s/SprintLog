<script setup lang="ts">
// Ausdauertest mit eigenem Takt - wie die offizielle Audiodatei: Yo-Yo IR1 (20 m hin/zurück, 10 s Erholung, Stufe
// steigt) bzw. 30-15 IFT (30 s Pendel mit Zonen-Signal alle 20 m, 15 s Pause, +0,5 km/h). Der Partner bedient:
// "Nicht geschafft" (Yo-Yo: 2. Mal = Ende; 30-15: 3 Mal in Folge = Ende) oder "Stopp". Ergebnis vor dem Speichern
// prüfen (±1 Pendel/Stufe). Wurde die App mitten im Lauf geschlossen, lässt sich der Test neu starten oder eintragen.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { intlLocale, t } from '@/i18n';
import { formatValue, rate, type Position } from '@/lib/fitnessTests';
import { IFT_STAGES, YOYO, iftAt, iftCompleted, iftCues, iftSpeed, yoyoAt, yoyoCompleted, yoyoCues, yoyoDistance, yoyoLabel, type Cue, type Endurance } from '@/lib/testDay';
import { createCuePlayer, speak } from '@/lib/cuePlayer';
import { isNative, tap as haptic } from '@/lib/native';
import { readJson, writeJson } from '@/lib/storage';
import { useAiStore } from '@/stores/ai';
import DecimalInput from '@/components/DecimalInput.vue';
import TestLayout from './TestLayout.vue';

const props = defineProps<{ kind: Endurance; state: { running: boolean; result: number | null; warnings: number } | null }>();
const emit = defineEmits<{ (e: 'patch', p: Partial<{ running: boolean; result: number | null; warnings: number }>): void; (e: 'next'): void; (e: 'skip'): void }>();

const COUNTDOWN = 5000;
const VOICE_KEY = 'sprintlog:testday:voice';
const view = ref<'intro' | 'run' | 'confirm' | 'done' | 'interrupted' | 'manual'>(
  props.state?.result != null ? 'done' : props.state?.running ? 'interrupted' : 'intro');
const voice = ref(readJson<boolean>(VOICE_KEY, true));
const toggleVoice = () => { voice.value = !voice.value; writeJson(VOICE_KEY, voice.value); };

const player = createCuePlayer();
let t0 = 0;
let ticker = 0;
const elapsed = ref(-COUNTDOWN);
const misses = ref(0);
const flash = ref(0);
/** Vorschlag/Ergebnis: Yo-Yo = geschaffte Pendel, 30-15 = Index der letzten geschafften Stufe (-1 = keine). */
const completed = ref(0);
const manual = ref<number | null>(null);

const yoyo = computed(() => yoyoAt(elapsed.value));
const ift = computed(() => iftAt(elapsed.value));
const counting = computed(() => elapsed.value < 0);

const phaseLabel = computed(() => {
  if (counting.value) return t('testDay.endur.ready');
  if (props.kind === 'yoyo') return t(`testDay.endur.${yoyo.value.phase === 'rest' ? 'rest' : yoyo.value.phase === 'back' ? 'back' : 'out'}`);
  return t(`testDay.endur.${ift.value.phase === 'rest' ? 'rest' : 'run'}`);
});
const phaseLeft = computed(() => (counting.value ? -elapsed.value : props.kind === 'yoyo' ? yoyo.value.leftMs : ift.value.leftMs));
const phaseShare = computed(() => {
  if (counting.value) return 1 + elapsed.value / COUNTDOWN;
  const st = props.kind === 'yoyo' ? yoyo.value : ift.value;
  return 1 - st.leftMs / st.phaseMs;
});
const isRest = computed(() => !counting.value && (props.kind === 'yoyo' ? yoyo.value.phase === 'rest' : ift.value.phase === 'rest'));

/** Laufende Distanz (Yo-Yo): geschaffte Pendel × 40 m. */
const distanceNow = computed(() => yoyo.value.index * 40 + (yoyo.value.phase === 'rest' ? 40 : 0));

function onCue(cue: Cue) {
  flash.value++;
  if (isNative()) haptic();
  if (!voice.value) return;
  const lang = intlLocale();
  if (props.kind === 'yoyo' && cue.kind === 'level') {
    const s = YOYO.find((x) => x.startMs === cue.at);
    if (s) speak(`${t('testDay.endur.level')} ${s.level}`, lang);
  } else if (props.kind === 'ift' && (cue.kind === 'start' || cue.kind === 'level')) {
    const st = iftAt(cue.at + 10);
    speak(formatValue('ift', iftSpeed(st.stage), lang), lang);
  }
}

function tick() {
  elapsed.value = performance.now() - t0;
  if (props.kind === 'yoyo' ? yoyo.value.phase === 'done' : ift.value.phase === 'done') stop();
}

function start() {
  misses.value = 0;
  t0 = performance.now() + COUNTDOWN;
  elapsed.value = -COUNTDOWN;
  const cues = [...(props.kind === 'yoyo' ? yoyoCues() : iftCues()), ...[3, 2, 1].map((k) => ({ at: -k * 1000, kind: 'tick' as const }))];
  player.start(cues, t0, { sound: true, onCue });
  window.clearInterval(ticker);
  ticker = window.setInterval(tick, 100);
  view.value = 'run';
  emit('patch', { running: true, result: null, warnings: 0 });
}

function stop() {
  window.clearInterval(ticker);
  player.stop();
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  if (counting.value) { view.value = 'intro'; emit('patch', { running: false }); return; }
  completed.value = props.kind === 'yoyo' ? yoyoCompleted(yoyo.value) : iftCompleted(ift.value);
  view.value = 'confirm';
  emit('patch', { running: false, warnings: misses.value });
}

/** Nicht rechtzeitig an der Linie/Zone: Yo-Yo 1 Verwarnung, 2. Mal Ende; 30-15 drei Mal in Folge = Ende. */
function miss() {
  misses.value++;
  haptic();
  if (misses.value >= (props.kind === 'yoyo' ? 2 : 3)) stop();
}

const maxCompleted = computed(() => (props.kind === 'yoyo' ? YOYO.length : IFT_STAGES - 1));
const minCompleted = computed(() => (props.kind === 'yoyo' ? 0 : -1));
const adjust = (d: number) => { completed.value = Math.max(minCompleted.value, Math.min(maxCompleted.value, completed.value + d)); };
const resultValue = computed<number | null>(() => {
  if (props.kind === 'yoyo') return completed.value > 0 ? yoyoDistance(completed.value) : null;
  return completed.value >= 0 ? iftSpeed(completed.value) : null;
});
/** Ergebnis groß (Yo-Yo-Stufe bzw. km/h) und darunter klein (Meter). */
const resultLabel = computed(() => {
  if (props.kind === 'yoyo') return completed.value > 0 ? yoyoLabel(YOYO[completed.value - 1]!) : t('testDay.endur.noResult');
  return resultValue.value != null ? formatValue('ift', resultValue.value, intlLocale()) : t('testDay.endur.noResult');
});
const resultSub = computed(() => (resultValue.value == null ? '' : props.kind === 'yoyo' ? `${resultValue.value} m` : 'km/h'));

function save(value: number | null) {
  if (value == null) return;
  emit('patch', { result: value, running: false });
  view.value = 'done';
}

const position = computed(() => (useAiStore().profile.position as Position | null) ?? null);
const level = computed(() => (props.state?.result != null ? rate(props.kind, props.state.result, position.value).level : null));
const shownResult = computed(() => (props.state?.result != null ? `${formatValue(props.kind, props.state.result, intlLocale())} ${props.kind === 'yoyo' ? 'm' : 'km/h'}` : ''));

const clock = (ms: number) => (ms / 1000).toFixed(ms < 10_000 ? 1 : 0);

onMounted(() => { if (view.value === 'interrupted') emit('patch', { running: false }); });
onBeforeUnmount(() => { window.clearInterval(ticker); player.stop(); });
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden" :data-test="`endurance-${kind}`">
      <!-- Einführung -->
      <template v-if="view === 'intro' || view === 'interrupted'">
          <div class="flex-1 overflow-y-auto px-5 pb-4 pt-2">
              <h2 class="display text-3xl leading-tight text-white">{{ t(`testDay.blocks.${kind}`) }}</h2>
              <p v-if="view === 'interrupted'" class="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-xs leading-snug text-amber-200" role="alert">{{ t('testDay.endur.interrupted') }}</p>
              <div class="mt-3 rounded-2xl bg-white/[0.04] p-3">
                  <TestLayout :block="kind" />
                  <p class="mt-2 text-xs leading-relaxed text-slate-300">{{ t(`testDay.protocol.${kind}`) }}</p>
              </div>
              <p class="mt-3 text-[11px] leading-snug text-slate-400">{{ t('testDay.endur.operator') }}</p>
              <p class="mt-1 text-[11px] leading-snug text-slate-400">{{ t('testDay.endur.loud') }}</p>
              <label class="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <span class="text-sm font-bold text-white">{{ t('testDay.endur.voice') }}</span>
                  <input type="checkbox" :checked="voice" class="h-5 w-5 accent-[var(--c-accent)]" @change="toggleVoice">
              </label>
          </div>
          <footer class="grid grid-cols-[auto_1fr] gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
              <button type="button" class="btn-secondary h-14 rounded-2xl px-4 text-sm" :data-test="view === 'interrupted' ? 'endurance-manual' : 'endurance-skip'" @click="view === 'interrupted' ? (view = 'manual') : emit('skip')">{{ view === 'interrupted' ? t('testDay.endur.manual') : t('testDay.skipTest') }}</button>
              <button type="button" class="btn-primary h-14 rounded-2xl text-base" data-test="endurance-start" @click="start">▶ {{ view === 'interrupted' ? t('testDay.endur.restart') : t('testDay.endur.start') }}</button>
          </footer>
      </template>

      <!-- Lauf -->
      <template v-else-if="view === 'run'">
          <div class="td-run flex flex-1 flex-col items-center justify-center px-6 text-center" :class="{ 'is-rest': isRest || counting }">
              <p :key="flash" class="player-kind td-flash" :class="isRest || counting ? 'is-rest' : 'is-work'" aria-live="polite" data-test="endurance-phase">{{ phaseLabel }}</p>
              <template v-if="kind === 'yoyo'">
                  <p class="mt-4 font-mono text-7xl font-black tabular-nums text-white" data-test="endurance-level">{{ counting ? Math.ceil(-elapsed / 1000) : yoyoLabel(YOYO[yoyo.index]!) }}</p>
                  <p class="mt-1 font-mono text-sm text-slate-300">{{ YOYO[yoyo.index]!.kmh }} km/h · {{ distanceNow }} m</p>
              </template>
              <template v-else>
                  <p class="mt-4 font-mono text-7xl font-black tabular-nums text-white" data-test="endurance-level">{{ counting ? Math.ceil(-elapsed / 1000) : formatValue('ift', iftSpeed(ift.stage), intlLocale()) }}</p>
                  <p class="mt-1 font-mono text-sm text-slate-300">km/h · {{ t('testDay.endur.stage', { n: ift.stage + 1 }) }}</p>
              </template>
              <div class="mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <div class="h-full rounded-full transition-[width] duration-100" :class="isRest || counting ? 'bg-emerald-400' : 'bg-accent'" :style="{ width: `${Math.round(phaseShare * 100)}%` }"></div>
              </div>
              <p class="mt-2 font-mono text-lg text-slate-200" role="timer">{{ clock(phaseLeft) }} s</p>
              <p v-if="misses" class="mt-4 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-200" data-test="endurance-misses">{{ kind === 'yoyo' ? t('testDay.endur.warning', { n: misses }) : t('testDay.endur.misses', { n: misses }) }}</p>
          </div>
          <footer class="grid grid-cols-2 gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
              <template v-if="kind === 'ift' && misses">
                  <button type="button" class="btn-secondary col-span-2 h-11 rounded-2xl text-xs" data-test="endurance-reset" @click="misses = 0">{{ t('testDay.endur.caughtUp') }}</button>
              </template>
              <button type="button" class="td-sw-btn is-split !h-16 !text-base" :disabled="counting" data-test="endurance-miss" @click="miss">{{ t('testDay.endur.miss') }}</button>
              <button type="button" class="td-sw-btn is-stop !h-16 !text-base" data-test="endurance-stop" @click="stop">{{ t('testDay.endur.stop') }}</button>
          </footer>
      </template>

      <!-- Ergebnis prüfen -->
      <template v-else-if="view === 'confirm'">
          <div class="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p class="text-xs font-bold caps tracking-label text-slate-400">{{ t('testDay.endur.lastCompleted') }}</p>
              <div class="mt-4 flex items-center gap-4">
                  <button type="button" class="player-ctl" :aria-label="t('testDay.endur.less')" :disabled="completed <= minCompleted" data-test="endurance-less" @click="adjust(-1)">−</button>
                  <p class="min-w-[7rem]" data-test="endurance-result">
                      <span class="block font-mono text-4xl font-black text-white">{{ resultLabel }}</span>
                      <span class="block font-mono text-sm text-slate-300">{{ resultSub }}</span>
                  </p>
                  <button type="button" class="player-ctl" :aria-label="t('testDay.endur.more')" :disabled="completed >= maxCompleted" data-test="endurance-more" @click="adjust(1)">+</button>
              </div>
              <p class="mt-4 max-w-xs text-xs leading-relaxed text-slate-400">{{ t(`testDay.endur.confirmHint.${kind}`) }}</p>
          </div>
          <footer class="grid grid-cols-[auto_1fr] gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
              <button type="button" class="btn-secondary h-14 rounded-2xl px-4 text-sm" @click="view = 'intro'">{{ t('testDay.endur.restart') }}</button>
              <button type="button" class="btn-primary h-14 rounded-2xl text-base" :disabled="resultValue == null" data-test="endurance-save" @click="save(resultValue)">✓ {{ t('testDay.endur.save') }}</button>
          </footer>
      </template>

      <!-- Manuell eintragen (nach Abbruch) -->
      <template v-else-if="view === 'manual'">
          <form class="flex flex-1 flex-col" @submit.prevent="manual != null && save(manual)">
              <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6">
                  <label for="td-manual" class="text-sm font-bold text-white">{{ t(`tests.names.${kind}`) }}</label>
                  <div class="flex items-center gap-2">
                      <DecimalInput id="td-manual" v-model="manual" :integer="kind === 'yoyo'" class="field h-14 w-32 rounded-xl px-2 text-center font-mono text-lg" />
                      <span class="text-sm text-slate-400">{{ kind === 'yoyo' ? 'm' : 'km/h' }}</span>
                  </div>
              </div>
              <footer class="px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
                  <button type="submit" class="btn-primary h-14 w-full rounded-2xl text-base" :disabled="manual == null">✓ {{ t('testDay.endur.save') }}</button>
              </footer>
          </form>
      </template>

      <!-- Fertig -->
      <template v-else>
          <div class="flex flex-1 flex-col items-center justify-center px-6 text-center" data-test="endurance-done">
              <p class="text-xs font-bold caps tracking-label text-slate-400">{{ t(`tests.names.${kind}`) }}</p>
              <p class="mt-2 font-mono text-4xl font-black text-white">{{ shownResult }}</p>
              <span v-if="level" class="level-chip mt-3" :class="`is-${level}`">{{ t(`tests.levels.${level}`) }}</span>
              <button type="button" class="routine-link mt-4" @click="view = 'intro'">{{ t('testDay.endur.redo') }}</button>
          </div>
          <footer class="px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
              <button type="button" class="btn-primary h-14 w-full rounded-2xl text-base" data-test="block-next" @click="emit('next')">{{ t('testDay.nextTest') }} →</button>
          </footer>
      </template>
  </div>
</template>
