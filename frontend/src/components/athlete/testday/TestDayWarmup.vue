<script setup lang="ts">
// Standardisiertes Aufwärmen (RAMP): Puls hoch, Mobilität, Aktivierung, Laufschule, Steigerungen, Probesprünge.
// Zeit-Schritte laufen automatisch weiter (Signal am Ende), die anderen mit "Fertig". Immer gleich = vergleichbare Tests.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import type { TestDaySession } from '@/stores/athlete';
import { warmupFor } from '@/lib/testDay';
import { playRestAlarm } from '@/lib/feedback';
import { tap as haptic } from '@/lib/native';

const props = defineProps<{ session: TestDaySession }>();
const emit = defineEmits<{ (e: 'patch', p: Partial<TestDaySession>): void; (e: 'done'): void }>();
const { settings } = storeToRefs(useAppStore());

const steps = computed(() => warmupFor(props.session.blocks));
const index = computed(() => Math.min(props.session.warmup, steps.value.length - 1));
const step = computed(() => steps.value[index.value] ?? null);
const now = ref(Date.now());
const left = computed(() => (props.session.stepEndsAt ? Math.max(0, props.session.stepEndsAt - now.value) : (step.value?.seconds ?? 0) * 1000));
const RING = 2 * Math.PI * 88;
const ringOffset = computed(() => (step.value?.seconds ? RING * (1 - left.value / (step.value.seconds * 1000)) : 0));
const clock = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function begin(i: number) {
  const st = steps.value[i];
  if (!st) { emit('done'); return; }
  emit('patch', { warmup: i, stepEndsAt: st.seconds ? Date.now() + st.seconds * 1000 : null });
}

function next() {
  haptic();
  begin(index.value + 1);
}

let ticker = 0;
onMounted(() => {
  // Erster Schritt startet sofort (Fortsetzen: Timer läuft über den Zeitstempel weiter)
  if (step.value?.seconds && !props.session.stepEndsAt) begin(index.value);
  ticker = window.setInterval(() => {
    now.value = Date.now();
    const end = props.session.stepEndsAt;
    if (end && now.value >= end) {
      playRestAlarm({ sound: settings.value.sound, vibration: settings.value.vibration });
      begin(index.value + 1);
    }
  }, 250);
});
onBeforeUnmount(() => window.clearInterval(ticker));
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden" data-test="test-day-warmup">
      <div v-if="step" class="flex flex-1 flex-col items-center overflow-y-auto px-6 pb-4 pt-4 text-center">
          <p class="player-kind is-work">{{ t('testDay.steps.warmup') }} · {{ index + 1 }}/{{ steps.length }}</p>
          <h2 class="display mt-2 text-2xl leading-tight text-white" data-test="warmup-step">{{ t(`testDay.warm.${step.id}.name`) }}</h2>
          <p class="mt-2 max-w-sm text-sm leading-relaxed text-slate-300">{{ t(`testDay.warm.${step.id}.text`) }}</p>
          <div v-if="step.seconds" class="relative mt-6 flex items-center justify-center">
              <svg class="player-ring" viewBox="0 0 200 200" aria-hidden="true">
                  <circle cx="100" cy="100" r="88" class="player-ring-track" />
                  <circle cx="100" cy="100" r="88" class="player-ring-fill is-work" :style="{ strokeDasharray: RING, strokeDashoffset: ringOffset }" />
              </svg>
              <span class="player-time absolute" role="timer">{{ clock(left) }}</span>
          </div>
          <ol class="mt-6 w-full max-w-sm space-y-1 text-left text-xs">
              <li v-for="(w, i) in steps" :key="w.id" class="flex items-center gap-2 rounded-lg px-2 py-1.5" :class="i === index ? 'bg-white/[0.06] text-white' : i < index ? 'text-slate-500 line-through' : 'text-slate-400'">
                  <span class="w-4 text-center font-mono">{{ i < index ? '✓' : i + 1 }}</span>
                  <span class="flex-1">{{ t(`testDay.warm.${w.id}.name`) }}</span>
                  <span class="font-mono text-[11px]">{{ w.seconds ? `${w.seconds / 60} ${t('testDay.min')}` : '' }}</span>
              </li>
          </ol>
      </div>
      <footer class="grid grid-cols-2 gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
          <button type="button" class="btn-secondary h-14 rounded-2xl text-sm" data-test="warmup-skip" @click="emit('done')">{{ t('testDay.skipWarmup') }}</button>
          <button type="button" class="btn-primary h-14 rounded-2xl text-base" data-test="warmup-next" @click="next">{{ step?.seconds ? t('testDay.next') : `✓ ${t('testDay.done')}` }}</button>
      </footer>
  </div>
</template>
