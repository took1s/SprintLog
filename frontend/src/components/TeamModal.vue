<script setup lang="ts">
// Mannschaftstraining erfassen: Dauer + Härte (sRPE) ergeben die Trainingslast wie bei jeder Einheit; dazu wie es lief,
// Schwerpunkt und Teilnahme - so wie Profi-Klubs jede Einheit protokollieren (Minuten, RPE, Inhalt, voll/teilweise/angepasst).
import { computed } from 'vue';
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore, SESSION_RPE, sessionRpeLabel } from '@/stores/app';
import { vSheetDrag } from '@/lib/gestures';
import type { TeamFocus, TeamParticipation } from '@/types';
import TeamIcon from './TeamIcon.vue';

const app = useAppStore();
const { teamModal } = storeToRefs(app);
const { saveTeam } = app;

const FOCI: readonly TeamFocus[] = ['tactical', 'technical', 'conditioning', 'game', 'recovery', 'mixed'];
const PARTICIPATION: readonly TeamParticipation[] = ['full', 'partial', 'modified', 'individual'];
/** Minuten-Schnellwahl (typische Vereinseinheiten). */
const QUICK_MINUTES = [60, 75, 90, 105, 120];

const load = computed(() => (teamModal.value.rpe && Number(teamModal.value.minutes) > 0 ? Math.round(teamModal.value.rpe * Number(teamModal.value.minutes)) : 0));
/** Einordnung der Last einer Einheit (Richtwerte für Vereinstraining: < 300 locker, 300-600 normal, > 600 hart). */
const loadTone = computed(() => (load.value >= 600 ? 'high' : load.value >= 300 ? 'moderate' : load.value > 0 ? 'low' : null));
const close = () => (teamModal.value.open = false);
</script>

<template>
  <transition name="sheet">
      <div v-if="teamModal.open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 sm:items-center" @click.self="close">
          <form v-sheet-drag:handle="close" @submit.prevent="saveTeam" class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
                role="dialog" aria-modal="true" :aria-label="`${teamModal.editing ? t('match.editTitle') : t('team.title')} ${t('team.titleAccent')}`" data-test="team-modal">
              <div class="mb-5 flex items-start justify-between gap-3">
                  <div>
                      <h3 class="text-2xl display text-white">{{ teamModal.editing ? t('match.editTitle') : t('team.title') }} <span class="text-accent">{{ t('team.titleAccent') }}</span></h3>
                      <p class="mt-1 font-mono text-tiny text-slate-400">{{ t('team.info') }}</p>
                  </div>
                  <button type="button" @click="close" class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label class="block">
                      <span class="label-xs mb-2">{{ t('finish.date') }}</span>
                      <input v-model="teamModal.date" type="datetime-local" class="cyber-input w-full rounded-xl p-3 text-sm">
                  </label>
                  <label class="block">
                      <span class="label-xs mb-2">{{ t('team.minutes') }}</span>
                      <input id="team-minutes" v-model.number="teamModal.minutes" type="number" min="1" max="240" inputmode="numeric" class="cyber-input w-full rounded-xl p-3 text-sm" data-test="team-minutes">
                  </label>
              </div>
              <div class="mb-5 flex flex-wrap gap-1.5" role="group" :aria-label="t('team.minutes')">
                  <button v-for="m in QUICK_MINUTES" :key="m" type="button" :aria-pressed="teamModal.minutes === m" :data-team-min="m" @click="teamModal.minutes = m"
                          class="min-h-[2.25rem] rounded-lg border px-3 font-mono text-xs font-bold transition-colors"
                          :class="teamModal.minutes === m ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ m }}′</button>
              </div>

              <span class="label-xs mb-2">{{ t('team.rpe') }} <span class="normal-case tracking-normal text-slate-500">{{ t('finish.sessionRpe') }}</span></span>
              <div class="mb-2 grid grid-cols-5 gap-1.5">
                  <button type="button" v-for="r in SESSION_RPE" :key="r.value" @click="teamModal.rpe = r.value" :data-team-rpe="r.value" :aria-pressed="teamModal.rpe === r.value"
                          class="rounded-lg border py-2 font-mono text-sm font-black transition-all"
                          :class="teamModal.rpe === r.value ? 'border-orange-400/70 bg-orange-400/15 text-orange-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ r.value }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-tiny text-slate-500" data-test="team-load">
                  <template v-if="teamModal.rpe">{{ sessionRpeLabel(teamModal.rpe) }}<template v-if="load"> · {{ t('finish.loadValue', { load }) }}<template v-if="loadTone"> · {{ t(`team.loadTone.${loadTone}`) }}</template></template></template>
              </p>

              <label class="label-xs mb-2">{{ t('team.howItWent') }} <span class="normal-case tracking-normal text-slate-500">{{ t('quality.optional') }}</span></label>
              <div class="mb-2 grid grid-cols-5 gap-1.5" role="radiogroup" :aria-label="t('team.howItWent')">
                  <button type="button" v-for="q in 10" :key="q" role="radio" :aria-checked="teamModal.quality === q" @click="teamModal.quality = teamModal.quality === q ? null : q" :data-team-quality="q"
                          class="rounded-lg border py-2 font-mono text-sm font-bold transition-all"
                          :class="teamModal.quality === q ? 'border-emerald-400/70 bg-emerald-400/15 text-emerald-400' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ q }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-tiny text-slate-500">{{ t('quality.hint') }}</p>

              <span class="label-xs mb-2">{{ t('team.focus') }} <span class="normal-case tracking-normal text-slate-500">({{ t('common.optional') }})</span></span>
              <div class="mb-5 flex flex-wrap gap-1.5" role="radiogroup" :aria-label="t('team.focus')">
                  <button v-for="f in FOCI" :key="f" type="button" role="radio" :aria-checked="teamModal.focus === f" :data-team-focus="f"
                          class="rounded-xl border px-3 py-2 text-xs font-bold transition-colors"
                          :class="teamModal.focus === f ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'"
                          @click="teamModal.focus = teamModal.focus === f ? null : f">{{ t(`team.foci.${f}`) }}</button>
              </div>

              <span class="label-xs mb-2">{{ t('team.participation') }}</span>
              <div class="mb-1 grid grid-cols-2 gap-1.5" role="radiogroup" :aria-label="t('team.participation')">
                  <button v-for="p in PARTICIPATION" :key="p" type="button" role="radio" :aria-checked="teamModal.participation === p" :data-team-part="p"
                          class="rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors"
                          :class="teamModal.participation === p ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'"
                          @click="teamModal.participation = p">{{ t(`team.parts.${p}`) }}</button>
              </div>
              <p class="mb-5 min-h-[1rem] font-mono text-tiny text-slate-500">{{ t(`team.partHints.${teamModal.participation}`) }}</p>

              <div v-if="teamModal.health" class="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-slate-300" data-test="team-health">
                  <span class="w-full text-tiny font-bold caps tracking-label text-slate-400">{{ t('match.fromWatch') }}</span>
                  <span v-if="teamModal.health.distanceM" class="lib-chip">{{ (teamModal.health.distanceM / 1000).toFixed(1) }} km</span>
                  <span v-if="teamModal.health.avgHr" class="lib-chip">Ø {{ teamModal.health.avgHr }} bpm</span>
                  <span v-if="teamModal.health.maxSpeedKmh" class="lib-chip">{{ teamModal.health.maxSpeedKmh }} {{ t('units.kmh') }}</span>
                  <span v-if="teamModal.health.sprints != null" class="lib-chip">{{ t('match.sprints', { n: teamModal.health.sprints }) }}</span>
              </div>

              <label class="label-xs mb-2" for="team-notes">{{ t('finish.notes') }}</label>
              <textarea id="team-notes" v-model="teamModal.notes" rows="2" maxlength="500" class="cyber-input mb-5 w-full resize-none rounded-xl p-3 text-sm" :placeholder="t('team.notesPlaceholder')" data-test="team-notes"></textarea>

              <p v-if="teamModal.error" class="mb-3 font-mono text-xs text-red-400" role="alert">{{ teamModal.error }}</p>
              <button type="submit" class="cyber-btn flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold" data-test="team-save"><TeamIcon class="h-5 w-5" />{{ teamModal.editing ? t('finish.saveChanges') : t('team.save') }}</button>
          </form>
      </div>
  </transition>
</template>
