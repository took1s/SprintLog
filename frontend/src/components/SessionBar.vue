<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { formatClock, formatDate } from '@/lib/format';

const app = useAppStore();
const { isEditing, session, sessionActive, sessionElapsed, tab } = storeToRefs(app);
const { finishSession } = app;
// Im Gym-/Feld-Tab zeigt WorkoutView die Einheit selbst - die Leiste dient nur als Rückweg aus dem Plan.
</script>

<template>
  <transition name="slide-up">
      <div v-if="sessionActive && tab === 'Plan'" class="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          <div class="glass-panel modal-panel pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-3xl p-3">
              <div class="flex min-w-0 items-center gap-3">
                  <div class="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono font-bold text-accent sm:flex">{{ session.sets.length }}</div>
                  <div class="min-w-0">
                      <div v-if="isEditing" class="text-sm font-bold text-orange-300">{{ t('session.editing', { date: formatDate(session.meta?.date ?? session.startedAt, { day: '2-digit', month: 'short' }) }) }}</div>
                      <div v-else class="truncate whitespace-nowrap text-sm font-bold text-white">{{ t('session.title') }}</div>
                      <div class="whitespace-nowrap font-mono text-xs text-slate-400">{{ formatClock(sessionElapsed) }}</div>
                  </div>
              </div>
              <div class="flex flex-shrink-0 gap-2">
                  <button @click="tab = session.sets.some((s) => s.category === 'Football') && !session.sets.some((s) => s.category === 'Gym') ? 'Football' : 'Gym'" class="btn-secondary h-11 rounded-xl px-4 text-sm font-bold">{{ t('workout.open') }}</button>
                  <button @click="finishSession" :disabled="!session.sets.length" class="btn-primary h-11 rounded-xl px-4 text-sm">{{ isEditing ? t('session.save') : t('session.finish') }}</button>
              </div>
          </div>
      </div>
  </transition>
</template>
