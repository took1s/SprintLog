<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore, SESSION_RPE, sessionRpeLabel } from '@/stores/app';

const app = useAppStore();
const { matchModal } = storeToRefs(app);
const { saveMatch } = app;

const load = computed(() => (matchModal.value.rpe && Number(matchModal.value.minutes) > 0 ? Math.round(matchModal.value.rpe * Number(matchModal.value.minutes)) : 0));
</script>

<template>
  <transition name="fade">
      <div v-if="matchModal.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 backdrop-blur-sm sm:items-center" @click.self="matchModal.open = false">
          <form @submit.prevent="saveMatch" class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8"
                role="dialog" aria-modal="true" :aria-label="`${matchModal.editing ? t('match.editTitle') : t('match.title')} ${t('match.titleAccent')}`">
              <div class="mb-5 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl font-black text-white">{{ matchModal.editing ? t('match.editTitle') : t('match.title') }} <span class="text-accent">{{ t('match.titleAccent') }}</span></h3>
                      <p class="mt-1 font-mono text-[10px] text-slate-400">{{ t('match.info') }}</p>
                  </div>
                  <button type="button" @click="matchModal.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="mb-4 grid grid-cols-2 gap-3">
                  <label class="block">
                      <span class="label-xs mb-2">{{ t('finish.date') }}</span>
                      <input v-model="matchModal.date" type="datetime-local" class="cyber-input w-full rounded-xl p-3 text-sm">
                  </label>
                  <label class="block">
                      <span class="label-xs mb-2">{{ t('match.minutes') }}</span>
                      <input id="match-minutes" v-model.number="matchModal.minutes" type="number" min="1" max="180" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm">
                  </label>
              </div>

              <span class="label-xs mb-2">{{ t('match.rpe') }} <span class="normal-case tracking-normal text-slate-500">{{ t('finish.sessionRpe') }}</span></span>
              <div class="mb-2 grid grid-cols-5 gap-1.5">
                  <button type="button" v-for="r in SESSION_RPE" :key="r.value" @click="matchModal.rpe = r.value" :data-match-rpe="r.value"
                          class="rounded-lg border py-2 font-mono text-sm font-black transition-all"
                          :class="matchModal.rpe === r.value ? 'border-orange-400/70 bg-orange-400/15 text-orange-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ r.value }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-[10px] text-slate-500">
                  <template v-if="matchModal.rpe">{{ sessionRpeLabel(matchModal.rpe) }}<template v-if="load"> · {{ t('finish.loadValue', { load }) }}</template></template>
              </p>

              <div class="mb-4 grid grid-cols-3 gap-3">
                  <label class="block"><span class="label-xs mb-2">{{ t('match.goals') }}</span>
                      <input v-model.number="matchModal.goals" type="number" min="0" max="20" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" placeholder="0"></label>
                  <label class="block"><span class="label-xs mb-2">{{ t('match.assists') }}</span>
                      <input v-model.number="matchModal.assists" type="number" min="0" max="20" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" placeholder="0"></label>
                  <label class="block"><span class="label-xs mb-2">{{ t('match.opponent') }}</span>
                      <input id="match-opponent" v-model="matchModal.opponent" maxlength="60" class="cyber-input w-full rounded-xl p-3 text-sm" :placeholder="t('match.opponentPlaceholder')"></label>
              </div>

              <label class="label-xs mb-2" for="match-notes">{{ t('finish.notes') }}</label>
              <textarea id="match-notes" v-model="matchModal.notes" rows="2" maxlength="500" class="cyber-input mb-5 w-full resize-none rounded-xl p-3 text-sm" :placeholder="t('match.notesPlaceholder')"></textarea>

              <p v-if="matchModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ matchModal.error }}</p>
              <button type="submit" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ matchModal.editing ? t('finish.saveChanges') : t('match.save') }}</button>
          </form>
      </div>
  </transition>
</template>
