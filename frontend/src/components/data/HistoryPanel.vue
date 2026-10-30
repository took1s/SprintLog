<script setup lang="ts">
import { t, tn } from '@/i18n';
import { exerciseName, categoryName } from '@/i18n/content';

const FILTERS = ['all', 'Gym', 'Football', 'Match', 'Hybrid'] as const;
import { storeToRefs } from 'pinia';
import { useAppStore, badgeClass, rpeText, sessionRpeLabel, setLabel, workoutStats } from '@/stores/app';
import { describeSet, formatDate, formatDuration, formatTime, formatWeekday } from '@/lib/format';
import { groupSetsByExercise, workoutKey } from '@/lib/analytics';

const app = useAppStore();
const { failedCount, filteredHistory, historyFilter, historyLimit, pendingCount, settings, syncing, visibleHistory } = storeToRefs(app);
const { deleteWorkout, editWorkout, programNameForDay, repeatWorkout, retryEntry, setBadges, syncNow } = app;
</script>

<template>
  <div class="space-y-5">
      <!-- Nicht gesendete Einheiten deutlich zeigen: Sie existieren nur auf diesem Gerät (anderer Browser sieht sie nicht). -->
      <div v-if="pendingCount || failedCount" role="status" data-testid="unsent-banner"
           class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/40 bg-orange-400/10 p-4">
          <div class="min-w-0 text-xs font-bold text-orange-200">
              <p v-if="pendingCount">{{ tn('history.unsent', pendingCount) }}</p>
              <p v-if="failedCount" class="text-red-300">{{ tn('history.unsentFailed', failedCount) }}</p>
          </div>
          <button v-if="pendingCount" @click="syncNow()" :disabled="syncing"
                  class="cyber-outline-btn rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
              {{ syncing ? t('settings.syncing') : t('history.sendNow') }}
          </button>
      </div>

      <div class="flex flex-wrap gap-2">
          <button v-for="f in FILTERS" :key="f" @click="historyFilter = f; historyLimit = 20"
                  class="chip" :class="historyFilter === f ? 'chip-active' : 'chip-idle'">{{ f === 'all' ? t('common.all') : t(`categories.${f}`) }}</button>
      </div>

      <article v-for="w in visibleHistory" :key="workoutKey(w)" class="glass-panel group relative rounded-2xl border-l-4 p-5"
               :class="{ 'border-l-purple-500': w.workoutType === 'Gym', 'border-l-accent': w.workoutType === 'Football', 'border-l-emerald-500': w.workoutType === 'Hybrid', 'border-l-yellow-400': w.workoutType === 'Match' }">
          <div class="mb-4 flex items-start justify-between gap-3 border-b border-white/5 pb-4">
              <div class="min-w-0">
                  <div class="text-xl font-black tracking-tight text-white">{{ formatDate(w.date) }}</div>
                  <div class="mt-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {{ formatWeekday(w.date) }} {{ formatTime(w.date) }}<template v-if="w.durationSeconds"> · {{ formatDuration(w.durationSeconds) }}</template>
                  </div>
                  <div class="mt-1 font-mono text-[10px] text-slate-500">{{ workoutStats(w) }}</div>
                  <div v-if="w.programDayId && programNameForDay(w.programDayId)" class="mt-1 font-mono text-[10px] text-accent">📋 {{ programNameForDay(w.programDayId) }}</div>
                  <div v-if="w.sessionRpe" class="mt-1 font-mono text-[10px] text-orange-300">{{ t('history.srpe', { value: w.sessionRpe, label: sessionRpeLabel(w.sessionRpe) }) }}</div>
              </div>
              <div class="flex flex-col items-end gap-2">
                  <span class="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                        :class="{
                          'border-purple-500/30 bg-purple-500/20 text-purple-400': w.workoutType === 'Gym',
                          'border-accent/30 bg-accent/10 text-accent': w.workoutType === 'Football',
                          'border-emerald-500/30 bg-emerald-500/20 text-emerald-400': w.workoutType === 'Hybrid',
                          'border-yellow-400/30 bg-yellow-400/10 text-yellow-300': w.workoutType === 'Match'
                        }">{{ w.workoutType === 'Match' ? '⚽ ' : '' }}{{ categoryName(w.workoutType) }}</span>
                  <span v-if="w.pending && w.status === 'failed'" class="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-red-400" :title="w.error ?? undefined">{{ t('history.syncFailed') }}</span>
                  <span v-else-if="w.pending" class="rounded border border-orange-400/40 bg-orange-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-orange-300">{{ w.op === 'update' ? t('history.editPending') : t('history.pendingSync') }}</span>
              </div>
          </div>

          <div v-if="w.workoutType === 'Match'" class="mb-1 flex flex-wrap items-center gap-2 text-sm" data-test="match-summary">
              <span v-if="w.match?.opponent" class="font-bold text-white">{{ t('match.vs', { opponent: w.match.opponent }) }}</span>
              <span v-if="w.match?.goals || w.match?.assists" class="rounded-md border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-yellow-300">
                  {{ t('match.goalsAssists', { goals: w.match?.goals ?? 0, assists: w.match?.assists ?? 0 }) }}</span>
          </div>
          <div v-else class="space-y-3">
              <div v-for="group in groupSetsByExercise(w.sets)" :key="group.key" class="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                  <div class="border-b border-white/5 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-accent">{{ exerciseName(group.exerciseId, group.name) }}</div>
                  <div class="space-y-1 p-2">
                      <template v-for="(set, n) in group.sets" :key="set.index">
                      <div class="flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/5">
                          <div class="flex items-center gap-3">
                              <span class="min-w-[4.5rem] whitespace-nowrap font-mono text-[10px] font-bold" :class="set.isWarmup ? 'text-slate-600' : 'text-slate-500'">{{ setLabel(group.sets, n) }}</span>
                              <span v-for="b in setBadges(w, set.index).slice(0, 2)" :key="b.field" class="rounded border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest" :class="badgeClass(b.tone)">{{ b.icon }} {{ t(`records.badges.${b.field}`) }}</span>
                          </div>
                          <span class="font-mono text-xs font-bold" :class="set.isWarmup ? 'text-slate-500' : 'text-white'">{{ describeSet(set, group.trackingType) }}<span v-if="set.rpe" class="ml-1.5 text-[10px] text-orange-300">{{ rpeText(set.rpe, settings.useRir) }}</span></span>
                      </div>
                      <p v-if="set.note" class="-mt-1 mb-1 pl-[3.75rem] pr-2 text-[11px] italic text-slate-400" data-test="set-note">{{ set.note }}</p>
                      </template>
                  </div>
              </div>
          </div>

          <p v-if="w.notes" class="mt-3 whitespace-pre-line rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs italic text-slate-300">{{ w.notes }}</p>
          <p v-if="w.pending && w.error" class="mt-3 font-mono text-[10px] text-red-400">{{ w.error }}</p>

          <div class="mt-4 flex flex-wrap justify-end gap-2">
              <button v-if="w.pending && w.status === 'failed'" @click="retryEntry(w)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">{{ t('common.retry') }}</button>
              <button @click="editWorkout(w)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">{{ t('common.edit') }}</button>
              <button @click="repeatWorkout(w)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">{{ t('history.performAgain') }}</button>
              <button @click="deleteWorkout(w)" class="danger-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest" :aria-label="t('history.deleteWorkout')">{{ t('common.delete') }}</button>
          </div>
      </article>

      <button v-if="filteredHistory.length > historyLimit" @click="historyLimit += 20" class="cyber-outline-btn w-full rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest">
          {{ t('history.showMore', { n: filteredHistory.length - historyLimit }) }}
      </button>
      <p v-if="!filteredHistory.length" class="glass-panel rounded-2xl p-8 text-center font-mono text-xs text-slate-500">{{ t('history.noneForFilter') }}</p>
  </div>
</template>
