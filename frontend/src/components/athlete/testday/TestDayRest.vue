<script setup lang="ts">
// Pause zwischen Versuchen bzw. vor dem nächsten Test: großer Countdown, was danach kommt, +30 s, "Bereit".
import { computed, ref, watch } from 'vue';
import { t } from '@/i18n';

const props = defineProps<{ until: number; now: number; kind: 'attempt' | 'block'; next: string }>();
const emit = defineEmits<{ (e: 'skip'): void; (e: 'add', seconds: number): void }>();

const left = computed(() => Math.max(0, props.until - props.now));
// Ring: Anteil der Restzeit an der Pausenlänge (bei +30 s wächst die Länge mit)
const full = ref(1000);
watch(() => props.until, () => { full.value = Math.max(full.value, props.until - props.now, 1000); }, { immediate: true });
const share = computed(() => Math.min(1, left.value / full.value));
const RING = 2 * Math.PI * 88;
const clock = computed(() => { const s = Math.ceil(left.value / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; });
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden" data-test="test-day-rest">
      <div class="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p class="player-kind is-rest">{{ kind === 'block' ? t('testDay.restBlock') : t('testDay.rest') }}</p>
          <div class="relative mt-6 flex items-center justify-center">
              <svg class="player-ring" viewBox="0 0 200 200" aria-hidden="true">
                  <circle cx="100" cy="100" r="88" class="player-ring-track" />
                  <circle cx="100" cy="100" r="88" class="player-ring-fill is-rest" :style="{ strokeDasharray: RING, strokeDashoffset: RING * (1 - share) }" />
              </svg>
              <span class="player-time absolute" :class="{ 'is-low': left <= 3000 }" role="timer" data-test="rest-time">{{ clock }}</span>
          </div>
          <p class="mt-6 text-xs font-bold caps tracking-label text-slate-400">{{ t('testDay.restNext') }}</p>
          <p class="mt-1 text-lg font-bold text-white" data-test="rest-next">{{ next }}</p>
          <p class="mt-3 max-w-xs text-xs leading-relaxed text-slate-400">{{ kind === 'block' ? t('testDay.restBlockHint') : t('testDay.restHint') }}</p>
      </div>
      <footer class="grid grid-cols-[auto_1fr] gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
          <button type="button" class="btn-secondary h-14 rounded-2xl px-5 text-sm" data-test="rest-plus" @click="emit('add', 30)">+30 s</button>
          <button type="button" class="btn-primary h-14 rounded-2xl text-base" data-test="rest-skip" @click="emit('skip')">{{ t('testDay.readyNow') }}</button>
      </footer>
  </div>
</template>
