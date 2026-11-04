<script setup lang="ts">
import { t, tn } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore, SESSION_RPE, sessionRpeLabel } from '@/stores/app';

const app = useAppStore();
const { finishLoad, finishModal, isEditing, session, sessionRecovery, sessionSummary } = storeToRefs(app);
const { confirmFinish } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="finishModal.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center" @click.self="finishModal.open = false">
          <form @submit.prevent="confirmFinish" class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8" role="dialog" aria-modal="true" :aria-label="isEditing ? `${t('finish.titleSave')} ${t('finish.titleSaveAccent')}` : `${t('finish.titleFinish')} ${t('finish.titleAccent')}`">
              <div class="mb-5 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl display text-white">{{ isEditing ? t('finish.titleSave') : t('finish.titleFinish') }} <span class="text-accent">{{ isEditing ? t('finish.titleSaveAccent') : t('finish.titleAccent') }}</span></h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">{{ t('finish.summary', { sets: tn('units.sets', session.sets.length), exercises: tn('units.exercises', sessionSummary.exercises) }) }}</p>
                  </div>
                  <button type="button" @click="finishModal.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <label class="label-xs mb-2">{{ t('finish.howHard') }} <span class="normal-case tracking-normal text-slate-500">{{ t('finish.sessionRpe') }}</span></label>
              <div class="mb-2 grid grid-cols-5 gap-1.5">
                  <button type="button" v-for="r in SESSION_RPE" :key="r.value" @click="finishModal.sessionRpe = finishModal.sessionRpe === r.value ? null : r.value"
                          class="rounded-lg border py-2 font-mono text-sm font-black transition-all"
                          :class="finishModal.sessionRpe === r.value ? 'border-orange-400/70 bg-orange-400/15 text-orange-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ r.value }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-[10px] text-slate-500">
                  <template v-if="finishModal.sessionRpe">{{ sessionRpeLabel(finishModal.sessionRpe) }}<template v-if="finishLoad"> · {{ t('finish.loadValue', { load: finishLoad }) }}</template></template>
                  <template v-else>{{ t('finish.rpeOptional') }}</template>
              </p>

              <label class="label-xs mb-2">{{ t('quality.label') }} <span class="normal-case tracking-normal text-slate-500">{{ t('quality.optional') }}</span></label>
              <div class="mb-2 grid grid-cols-5 gap-1.5" role="radiogroup" :aria-label="t('quality.label')">
                  <button type="button" v-for="q in 10" :key="q" role="radio" :aria-checked="finishModal.quality === q" @click="finishModal.quality = finishModal.quality === q ? null : q" :data-quality="q"
                          class="rounded-lg border py-2 font-mono text-sm font-bold transition-all"
                          :class="finishModal.quality === q ? 'border-emerald-400/70 bg-emerald-400/15 text-emerald-400' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ q }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-[10px] text-slate-500">{{ t('quality.hint') }}</p>

              <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="block">
                      <span class="label-xs mb-2">{{ t('finish.date') }}</span>
                      <input v-model="finishModal.date" type="datetime-local" class="cyber-input w-full rounded-xl p-3 text-sm">
                  </label>
                  <label class="block">
                      <span class="label-xs mb-2">{{ t('finish.duration') }}</span>
                      <input v-model.number="finishModal.durationMin" type="number" min="1" max="1440" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" :placeholder="t('finish.durationPlaceholder')">
                  </label>
              </div>

              <label class="label-xs mb-2" for="finish-notes">{{ t('finish.notes') }}</label>
              <textarea id="finish-notes" v-model="finishModal.notes" rows="3" maxlength="500" class="cyber-input mb-1 w-full resize-none rounded-xl p-3 text-sm" :placeholder="t('finish.notesPlaceholder')"></textarea>
              <p class="mb-5 text-right font-mono text-[9px] text-slate-600">{{ (finishModal.notes || '').length }}/500</p>

              <p v-if="!isEditing" class="mb-4 flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs text-slate-300" data-test="finish-recovery">
                  <svg class="h-4 w-4 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path stroke-linecap="round" d="M12 7.5V12l3 2"/></svg>
                  <span>{{ sessionRecovery.total > 0 ? t('recovery.estimate', { hours: sessionRecovery.total }) : t('recovery.light') }}<template v-if="sessionRecovery.main && sessionRecovery.total > 0"> · {{ t(`recovery.regions.${sessionRecovery.main}`) }}</template></span>
              </p>
              <p v-if="finishModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ finishModal.error }}</p>
              <button type="submit" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ isEditing ? t('finish.saveChanges') : t('finish.saveWorkout') }}</button>
          </form>
      </div>
  </transition>
</template>
