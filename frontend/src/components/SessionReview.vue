<script setup lang="ts">
import { t, tn } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore, rpeText, setLabel } from '@/stores/app';
import { describeSet, formatClock, formatDate } from '@/lib/format';

const app = useAppStore();
const { isEditing, session, sessionElapsed, sessionGroups, settings, showReview } = storeToRefs(app);
const { abortSession, editSessionSet, finishSession, removeSessionSet } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="showReview" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/80 p-2 backdrop-blur-md sm:items-center sm:p-4" @click.self="showReview = false">
          <div class="glass-panel modal-panel relative flex max-h-[88vh] w-full max-w-md flex-col rounded-[2rem] border border-accent/20 p-6" role="dialog" aria-modal="true" :aria-label="`${t('session.reviewTitle')} ${t('session.reviewAccent')}`">
              <div class="mb-5 flex items-center justify-between">
                  <div>
                      <h3 class="text-2xl font-black tracking-tight text-white">{{ isEditing ? t('session.editTitle') : t('session.reviewTitle') }} <span class="text-accent">{{ isEditing ? t('session.editAccent') : t('session.reviewAccent') }}</span></h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                          <template v-if="isEditing">{{ t('session.editInfo', { date: formatDate(session.meta?.date ?? session.startedAt), sets: tn('units.sets', session.sets.length) }) }}</template>
                          <template v-else>{{ tn('units.sets', session.sets.length) }} · {{ formatClock(sessionElapsed) }}</template>
                      </p>
                  </div>
                  <button @click="showReview = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 space-y-3 overflow-y-auto pr-1">
                  <div v-for="g in sessionGroups" :key="g.key" class="overflow-hidden rounded-2xl border border-white/5 bg-black/30">
                      <div class="border-b border-white/5 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-accent">{{ exerciseName(g.exerciseId, g.name) }}</div>
                      <div v-for="(set, n) in g.sets" :key="set.index" class="flex items-center justify-between px-4 py-2.5">
                          <div class="flex items-center gap-3">
                              <span class="w-10 font-mono text-[10px] font-bold text-slate-500">{{ setLabel(g.sets, n) }}</span>
                              <span class="font-mono text-xs font-bold" :class="set.isWarmup ? 'text-slate-500' : 'text-white'">{{ describeSet(set, g.trackingType) }}<span v-if="set.rpe" class="ml-1.5 text-[10px] text-orange-300">{{ rpeText(set.rpe, settings.useRir) }}</span></span>
                          </div>
                          <div class="flex gap-2">
                              <button @click="editSessionSet(set.index)" class="cyber-outline-btn flex h-8 w-8 items-center justify-center rounded-lg" :aria-label="t('session.editSet')">
                                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                              </button>
                              <button @click="removeSessionSet(set.index)" class="danger-btn flex h-8 w-8 items-center justify-center rounded-lg" :aria-label="t('session.removeSet')">
                                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

              <div class="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  <button @click="abortSession" class="danger-btn rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest">{{ isEditing ? t('session.cancelEdit') : t('session.discard') }}</button>
                  <button @click="finishSession" class="cyber-btn rounded-xl py-3 text-xs font-bold">{{ isEditing ? t('session.saveChanges') : t('session.finishSave') }}</button>
              </div>
          </div>
      </div>
  </transition>
</template>
