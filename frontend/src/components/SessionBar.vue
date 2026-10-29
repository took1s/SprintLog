<script setup lang="ts">
import { t, tn } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { formatClock, formatCompact, formatDate } from '@/lib/format';

const app = useAppStore();
const { isEditing, session, sessionActive, sessionElapsed, sessionSummary, showReview, tab } = storeToRefs(app);
const { finishSession } = app;
</script>

<template>
  <transition name="slide-up">
      <div v-if="sessionActive && tab !== 'Data'" class="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <div class="glass-panel pointer-events-auto flex w-full max-w-3xl items-center justify-between rounded-3xl border border-accent/30 p-4 shadow-[0_0_30px_rgba(0,195,255,0.15)]">
              <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 bg-accent/20 font-black text-accent">{{ session.sets.length }}</div>
                  <div>
                      <div v-if="isEditing" class="text-sm font-bold text-orange-300">{{ t('session.editing', { date: formatDate(session.meta?.date ?? session.startedAt, { day: '2-digit', month: 'short' }) }) }}</div>
                      <div v-else class="text-sm font-bold text-white">{{ t('session.title') }} · <span class="font-mono">{{ formatClock(sessionElapsed) }}</span></div>
                      <div class="font-mono text-[10px] uppercase tracking-widest text-accent">{{ tn('units.exercises', sessionSummary.exercises) }}<template v-if="sessionSummary.volume"> · {{ formatCompact(sessionSummary.volume) }} {{ t('units.kg') }}</template></div>
                  </div>
              </div>
              <div class="flex gap-2">
                  <button @click="showReview = true" class="cyber-outline-btn rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest">{{ t('session.review') }}</button>
                  <button @click="finishSession" class="cyber-btn rounded-xl px-4 py-2 text-xs font-bold">{{ isEditing ? t('session.save') : t('session.finish') }}</button>
              </div>
          </div>
      </div>
  </transition>
</template>
