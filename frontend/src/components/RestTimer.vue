<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { formatClock } from '@/lib/format';

const app = useAppStore();
const { isAuthenticated, timerActive, timerLeft, timerProgress } = storeToRefs(app);
const { adjustTimer, stopTimer } = app;
</script>

<template>
  <transition name="slide-up">
      <div v-if="isAuthenticated && timerActive" class="glass-panel modal-panel fixed bottom-28 left-1/2 z-[35] flex -translate-x-1/2 items-center gap-3 rounded-full border border-accent/40 py-2 pl-2 pr-3 shadow-glow" role="timer" :aria-label="t('timer.label')">
          <svg class="h-9 w-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" class="text-white/10" stroke="currentColor" stroke-width="3"></circle>
              <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
                      :stroke-dasharray="94.25" :stroke-dashoffset="94.25 * (1 - timerProgress)" class="text-accent transition-all duration-500"></circle>
          </svg>
          <div class="w-14 text-center font-mono text-lg font-black tracking-wider text-white">{{ formatClock(timerLeft) }}</div>
          <div class="flex items-center gap-1 border-l border-white/10 pl-2">
              <button @click="adjustTimer(-15)" class="h-8 w-9 rounded-full text-[10px] font-bold text-slate-400 transition-colors hover:bg-white/10 hover:text-white" :aria-label="t('timer.minus')">-15</button>
              <button @click="adjustTimer(15)" class="h-8 w-9 rounded-full text-[10px] font-bold text-slate-400 transition-colors hover:bg-white/10 hover:text-white" :aria-label="t('timer.plus')">+15</button>
              <button @click="stopTimer" class="danger-btn ml-1 flex h-8 w-8 items-center justify-center rounded-full" :aria-label="t('timer.stop')">
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
          </div>
      </div>
  </transition>
</template>
