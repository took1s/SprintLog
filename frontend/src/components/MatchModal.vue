<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore, SESSION_RPE, sessionRpeLabel } from '@/stores/app';
import { vSheetDrag } from '@/lib/gestures';
import { POSITIONS } from '@/stores/ai';

const app = useAppStore();
const { matchModal } = storeToRefs(app);
const { saveMatch } = app;

const load = computed(() => (matchModal.value.rpe && Number(matchModal.value.minutes) > 0 ? Math.round(matchModal.value.rpe * Number(matchModal.value.minutes)) : 0));
</script>

<template>
  <transition name="sheet">
      <div v-if="matchModal.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 sm:items-center" @click.self="matchModal.open = false">
          <form v-sheet-drag:handle="() => (matchModal.open = false)" @submit.prevent="saveMatch" class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
                role="dialog" aria-modal="true" :aria-label="`${matchModal.editing ? t('match.editTitle') : t('match.title')} ${t('match.titleAccent')}`">
              <div class="mb-5 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl display text-white">{{ matchModal.editing ? t('match.editTitle') : t('match.title') }} <span class="text-accent">{{ t('match.titleAccent') }}</span></h3>
                      <p class="mt-1 font-mono text-[10px] text-slate-400">{{ t('match.info') }}</p>
                  </div>
                  <button type="button" @click="matchModal.open = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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

              <label class="label-xs mb-2">{{ t('quality.label') }} <span class="normal-case tracking-normal text-slate-500">{{ t('quality.optional') }}</span></label>
              <div class="mb-2 grid grid-cols-5 gap-1.5" role="radiogroup" :aria-label="t('quality.label')">
                  <button type="button" v-for="q in 10" :key="q" role="radio" :aria-checked="matchModal.quality === q" @click="matchModal.quality = matchModal.quality === q ? null : q" :data-quality="q"
                          class="rounded-lg border py-2 font-mono text-sm font-bold transition-all"
                          :class="matchModal.quality === q ? 'border-emerald-400/70 bg-emerald-400/15 text-emerald-400' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ q }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-[10px] text-slate-500">{{ t('quality.hint') }}</p>

              <div class="mb-4 grid grid-cols-3 gap-3">
                  <label class="block"><span class="label-xs mb-2">{{ t('match.goals') }}</span>
                      <input v-model.number="matchModal.goals" type="number" min="0" max="20" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" placeholder="0"></label>
                  <label class="block"><span class="label-xs mb-2">{{ t('match.assists') }}</span>
                      <input v-model.number="matchModal.assists" type="number" min="0" max="20" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" placeholder="0"></label>
                  <label class="block"><span class="label-xs mb-2">{{ t('match.opponent') }}</span>
                      <input id="match-opponent" v-model="matchModal.opponent" maxlength="60" class="cyber-input w-full rounded-xl p-3 text-sm" :placeholder="t('match.opponentPlaceholder')"></label>
              </div>

              <!-- Position und Endstand -->
              <span class="label-xs mb-2">{{ t('match.position') }}</span>
              <div class="mb-4 grid grid-cols-3 gap-1.5" role="radiogroup" :aria-label="t('match.position')" data-test="match-position">
                  <button v-for="p in POSITIONS" :key="p" type="button" role="radio" :aria-checked="matchModal.position === p" :data-position="p"
                          class="rounded-lg border px-1 py-2 text-xs font-bold transition-all"
                          :class="matchModal.position === p ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'"
                          @click="matchModal.position = matchModal.position === p ? null : p">{{ t(`ai.profile.positions.${p}`) }}</button>
              </div>
              <span class="label-xs mb-2">{{ t('match.score') }}</span>
              <div class="mb-4 flex items-center gap-2">
                  <input v-model.number="matchModal.teamGoals" type="number" min="0" max="50" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-center text-sm" :aria-label="t('match.scoreUs')" :placeholder="t('match.scoreUs')" data-test="match-team-goals">
                  <span class="font-black text-slate-500">:</span>
                  <input v-model.number="matchModal.opponentGoals" type="number" min="0" max="50" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-center text-sm" :aria-label="t('match.scoreThem')" :placeholder="t('match.scoreThem')" data-test="match-opp-goals">
              </div>
              <label class="label-xs mb-2" for="match-well">{{ t('match.wentWell') }}</label>
              <textarea id="match-well" v-model="matchModal.wentWell" rows="2" maxlength="300" class="cyber-input mb-3 w-full resize-none rounded-xl p-3 text-sm" :placeholder="t('match.wentWellPlaceholder')" data-test="match-went-well"></textarea>
              <label class="label-xs mb-2" for="match-improve">{{ t('match.toImprove') }}</label>
              <textarea id="match-improve" v-model="matchModal.toImprove" rows="2" maxlength="300" class="cyber-input mb-4 w-full resize-none rounded-xl p-3 text-sm" :placeholder="t('match.toImprovePlaceholder')" data-test="match-to-improve"></textarea>
              <!-- Werte der Uhr (aus Apple Health übernommen) -->
              <div v-if="matchModal.health" class="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-slate-300" data-test="match-health">
                  <span class="w-full text-[10px] font-bold uppercase tracking-label text-slate-400">{{ t('match.fromWatch') }}</span>
                  <span v-if="matchModal.health.distanceM" class="lib-chip">{{ (matchModal.health.distanceM / 1000).toFixed(1) }} km</span>
                  <span v-if="matchModal.health.avgHr" class="lib-chip">Ø {{ matchModal.health.avgHr }} bpm</span>
                  <span v-if="matchModal.health.maxSpeedKmh" class="lib-chip">{{ matchModal.health.maxSpeedKmh }} km/h</span>
                  <span v-if="matchModal.health.sprints != null" class="lib-chip">{{ t('match.sprints', { n: matchModal.health.sprints }) }}</span>
              </div>
              <label class="label-xs mb-2" for="match-notes">{{ t('finish.notes') }}</label>
              <textarea id="match-notes" v-model="matchModal.notes" rows="2" maxlength="500" class="cyber-input mb-5 w-full resize-none rounded-xl p-3 text-sm" :placeholder="t('match.notesPlaceholder')"></textarea>

              <p v-if="matchModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ matchModal.error }}</p>
              <button type="submit" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ matchModal.editing ? t('finish.saveChanges') : t('match.save') }}</button>
          </form>
      </div>
  </transition>
</template>
