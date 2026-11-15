<script setup lang="ts">
// Stoppuhr für den Partner: Start bei der ersten Bewegung, Zwischenzeit bei 10 m, Stopp wenn die Brust die Linie quert.
// Reagiert auf pointerdown (nicht click) - spart ~100 ms Verzögerung. Zeit über performance.now() (ms-genau).
import { computed, onBeforeUnmount, ref } from 'vue';
import { t } from '@/i18n';
import { tap as haptic } from '@/lib/native';

defineProps<{ withSplit: boolean }>();
const emit = defineEmits<{ (e: 'result', r: { split: number | null; total: number }): void }>();

const state = ref<'idle' | 'running' | 'done'>('idle');
const startAt = ref(0);
const elapsed = ref(0);
const splitAt = ref<number | null>(null);
let raf = 0;

function frame() {
  elapsed.value = (performance.now() - startAt.value) / 1000;
  raf = requestAnimationFrame(frame);
}

function start() {
  if (state.value !== 'idle') return;
  startAt.value = performance.now();
  splitAt.value = null;
  state.value = 'running';
  haptic();
  raf = requestAnimationFrame(frame);
}

function split() {
  if (state.value !== 'running' || splitAt.value != null) return;
  splitAt.value = (performance.now() - startAt.value) / 1000;
  haptic();
}

function stop() {
  if (state.value !== 'running') return;
  cancelAnimationFrame(raf);
  elapsed.value = (performance.now() - startAt.value) / 1000;
  state.value = 'done';
  haptic();
}

function reset() { cancelAnimationFrame(raf); state.value = 'idle'; elapsed.value = 0; splitAt.value = null; }

function use() {
  emit('result', { split: splitAt.value != null ? Math.round(splitAt.value * 100) / 100 : null, total: Math.round(elapsed.value * 100) / 100 });
  reset();
}

onBeforeUnmount(() => cancelAnimationFrame(raf));
const shown = computed(() => elapsed.value.toFixed(2));
</script>

<template>
  <div class="td-stopwatch" data-test="stopwatch">
      <p class="text-center font-mono text-5xl font-black tabular-nums text-white" role="timer" data-test="stopwatch-time">{{ shown }}<span class="ml-1 text-lg text-slate-400">s</span></p>
      <p v-if="withSplit && splitAt != null" class="mt-1 text-center font-mono text-sm text-slate-300">10 m · {{ splitAt.toFixed(2) }} s</p>
      <p v-else class="mt-1 text-center text-[11px] text-slate-400">{{ t('testDay.stopwatch.hint') }}</p>
      <div class="mt-4">
          <button v-if="state === 'idle'" type="button" class="td-sw-btn is-start" data-test="sw-start" @pointerdown.prevent="start" @keydown.enter.prevent="start">{{ t('testDay.stopwatch.start') }}</button>
          <div v-else-if="state === 'running'" class="grid gap-3" :class="withSplit ? 'grid-cols-2' : 'grid-cols-1'">
              <button v-if="withSplit" type="button" class="td-sw-btn is-split" :disabled="splitAt != null" data-test="sw-split" @pointerdown.prevent="split" @keydown.enter.prevent="split">{{ t('testDay.stopwatch.split') }}</button>
              <button type="button" class="td-sw-btn is-stop" data-test="sw-stop" @pointerdown.prevent="stop" @keydown.enter.prevent="stop">{{ t('testDay.stopwatch.stop') }}</button>
          </div>
          <div v-else class="grid grid-cols-[auto_1fr] gap-3">
              <button type="button" class="btn-secondary h-14 rounded-2xl px-5 text-sm" data-test="sw-reset" @click="reset">{{ t('testDay.stopwatch.reset') }}</button>
              <button type="button" class="btn-primary h-14 rounded-2xl text-base" data-test="sw-use" @click="use">✓ {{ t('testDay.saveAttempt') }}</button>
          </div>
      </div>
  </div>
</template>
