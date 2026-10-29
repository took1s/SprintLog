<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, SESSION_RPE, sessionRpeLabel } from '@/stores/app';

const app = useAppStore();
const { finishLoad, finishModal, isEditing, session, sessionSummary } = storeToRefs(app);
const { confirmFinish } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="finishModal.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center" @click.self="finishModal.open = false">
          <form @submit.prevent="confirmFinish" class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8" role="dialog" aria-modal="true" aria-label="Finish workout">
              <div class="mb-5 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl font-black text-white">{{ isEditing ? 'Save' : 'Finish' }} <span class="text-accent">workout</span></h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">{{ session.sets.length }} sets · {{ sessionSummary.exercises }} exercises</p>
                  </div>
                  <button type="button" @click="finishModal.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" aria-label="Close">✕</button>
              </div>

              <label class="label-xs mb-2">How hard was the session? <span class="normal-case tracking-normal text-slate-500">(session RPE)</span></label>
              <div class="mb-2 grid grid-cols-5 gap-1.5">
                  <button type="button" v-for="r in SESSION_RPE" :key="r.value" @click="finishModal.sessionRpe = finishModal.sessionRpe === r.value ? null : r.value"
                          class="rounded-lg border py-2 font-mono text-sm font-black transition-all"
                          :class="finishModal.sessionRpe === r.value ? 'border-orange-400/70 bg-orange-400/15 text-orange-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ r.value }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-[10px] text-slate-500">
                  <template v-if="finishModal.sessionRpe">{{ sessionRpeLabel(finishModal.sessionRpe) }}<template v-if="finishLoad"> · training load {{ finishLoad }} AU</template></template>
                  <template v-else>Optional - used for training load (RPE × minutes)</template>
              </p>

              <div class="mb-4 grid grid-cols-2 gap-3">
                  <label class="block">
                      <span class="label-xs mb-2">Date &amp; time</span>
                      <input v-model="finishModal.date" type="datetime-local" class="cyber-input w-full rounded-xl p-3 text-sm">
                  </label>
                  <label class="block">
                      <span class="label-xs mb-2">Duration (min)</span>
                      <input v-model.number="finishModal.durationMin" type="number" min="1" max="1440" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" placeholder="e.g. 60">
                  </label>
              </div>

              <label class="label-xs mb-2" for="finish-notes">Notes</label>
              <textarea id="finish-notes" v-model="finishModal.notes" rows="3" maxlength="500" class="cyber-input mb-1 w-full resize-none rounded-xl p-3 text-sm" placeholder="How did it feel? Pain, sleep, conditions..."></textarea>
              <p class="mb-5 text-right font-mono text-[9px] text-slate-600">{{ (finishModal.notes || '').length }}/500</p>

              <p v-if="finishModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ finishModal.error }}</p>
              <button type="submit" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ isEditing ? 'Save changes' : 'Save workout' }}</button>
          </form>
      </div>
  </transition>
</template>
