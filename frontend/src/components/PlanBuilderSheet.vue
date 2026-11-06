<script setup lang="ts">
// "Plan für mich": vier Fragen, live die drei passendsten Vorlagen - Start übernimmt Programm UND Wochenplan.
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn, intlLocale } from '@/i18n';
import { goalName, levelName, templateText } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { deviceOnline, useAiStore } from '@/stores/ai';
import { exerciseName } from '@/i18n/content';
import { WEEKDAYS } from '@/lib/schedule';
import type { PlanFocus, PlanLevel } from '@/lib/planBuilder';
import { vSheetDrag } from '@/lib/gestures';

const app = useAppStore();
const { online, planBuilder, planChoices } = storeToRefs(app);
const { startPlanChoice } = app;

const FOCUSES: PlanFocus[] = ['football', 'speed', 'strength', 'muscle', 'rehab'];
const LEVELS: PlanLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const DAYS = [2, 3, 4, 5] as const;
// 1.1.2024 war ein Montag
const dayLabel = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '');
/** Ausgeschrieben für Screenreader ("Sonntag" statt "So"). */
const dayLong = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(intlLocale(), { weekday: 'long' });

const a = computed(() => planBuilder.value.answers);
const close = () => { planBuilder.value.open = false; };
const chip = (on: boolean) => (on ? 'chip chip-active' : 'chip chip-idle');

// ---------- Plan von der KI ----------
const ai = useAiStore();
const { plan: aiPlan } = storeToRefs(ai);
const { exercisesById } = storeToRefs(app);
if (!ai.status) void ai.loadStatus();
/** "Nordic Curl 3×6-8" / "Sprints 6×30 m" / "Plank 3×45 s" */
function prescription(x: { exerciseId: number; sets: number; repsMin?: number | null; repsMax?: number | null; distance?: number | null; time?: number | null }) {
  const ex = exercisesById.value.get(x.exerciseId);
  const name = ex ? exerciseName(ex) : `#${x.exerciseId}`;
  const what = x.distance ? `${x.distance} ${t('units.m')}` : x.time ? `${x.time} ${t('units.s')}` : x.repsMin ? `${x.repsMin}${x.repsMax && x.repsMax !== x.repsMin ? `-${x.repsMax}` : ''}` : '';
  return `${name} ${x.sets}×${what}`;
}

// Fokus folgt dem Inhalt: der Knopf, der gerade fokussiert war, verschwindet beim Umschalten Formular <-> Ergebnis.
const aiPlanName = ref<HTMLElement | null>(null);
const aiPlanGenerate = ref<HTMLButtonElement | null>(null);
watch(() => !!aiPlan.value.result, (has, had) => {
  if (has === had) return;
  // Ergebnis: Name fokussieren (scrollt ihn ins Bild, Screenreader liest den Plan); zurück: wieder auf "Составить план"
  void nextTick(() => (has ? aiPlanName.value?.focus() : aiPlanGenerate.value?.focus({ preventScroll: true })));
});
</script>

<template>
  <transition name="sheet">
      <div v-if="planBuilder.open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="close">
          <div v-sheet-drag:handle="close" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="t('builder.title')" data-test="plan-builder">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('builder.kicker') }}</p>
                      <h2 class="display mt-1 text-2xl text-white">{{ t('builder.title') }}</h2>
                      <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ t('builder.intro') }}</p>
                  </div>
                  <button type="button" @click="close" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                  <fieldset class="mb-5">
                      <legend class="label-xs mb-2">{{ t('builder.focus') }}</legend>
                      <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('builder.focus')">
                          <button v-for="f in FOCUSES" :key="f" type="button" role="radio" :aria-checked="a.focus === f" @click="a.focus = f" :class="chip(a.focus === f)" :data-focus="f">{{ t(`builder.focuses.${f}`) }}</button>
                      </div>
                  </fieldset>

                  <fieldset class="mb-5">
                      <legend class="label-xs mb-2">{{ t('builder.days') }}</legend>
                      <div class="grid grid-cols-4 gap-2" role="radiogroup" :aria-label="t('builder.days')">
                          <button v-for="n in DAYS" :key="n" type="button" role="radio" :aria-checked="a.daysPerWeek === n" @click="a.daysPerWeek = n"
                                  class="rounded-xl border py-3 font-mono text-base font-black transition-colors"
                                  :class="a.daysPerWeek === n ? 'border-accent bg-accent text-on-accent' : 'border-white/10 bg-white/5 text-slate-300'" :data-days="n">{{ n }}</button>
                      </div>
                  </fieldset>

                  <fieldset class="mb-5">
                      <legend class="label-xs mb-2">{{ t('builder.matchDay') }}</legend>
                      <!-- 7 Tage in einer Reihe, "kein Spiel" als eigene Zeile: 8 Spalten wären < 44 px breit und "KEIN SPIEL" passt nicht hinein -->
                      <div class="grid grid-cols-7 gap-1.5" role="radiogroup" :aria-label="t('builder.matchDay')">
                          <button v-for="d in WEEKDAYS" :key="d" type="button" role="radio" :aria-checked="a.matchDay === d" @click="a.matchDay = d" :aria-label="dayLong(d)"
                                  class="min-h-[2.75rem] rounded-lg border text-[11px] font-bold uppercase tracking-label transition-colors"
                                  :class="a.matchDay === d ? 'border-yellow-400 bg-yellow-400/15 text-yellow-300' : 'border-white/10 bg-white/5 text-slate-400'" :data-match="d">{{ dayLabel(d) }}</button>
                          <button type="button" role="radio" :aria-checked="a.matchDay === null" @click="a.matchDay = null"
                                  class="col-span-7 min-h-[2.75rem] rounded-lg border text-[11px] font-bold uppercase tracking-label transition-colors"
                                  :class="a.matchDay === null ? 'border-white/60 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-slate-400'">{{ t('builder.noMatch') }}</button>
                      </div>
                  </fieldset>

                  <fieldset v-if="a.focus !== 'rehab'" class="mb-6">
                      <legend class="label-xs mb-2">{{ t('builder.level') }}</legend>
                      <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('builder.level')">
                          <button v-for="l in LEVELS" :key="l" type="button" role="radio" :aria-checked="a.level === l" @click="a.level = l" :class="chip(a.level === l)">{{ levelName(l) }}</button>
                      </div>
                  </fieldset>
                  <p v-else class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs leading-relaxed text-emerald-200">{{ t('builder.rehabNote') }}</p>

                  <section v-if="ai.enabled" class="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4" aria-labelledby="ai-plan-title" data-test="ai-plan">
                      <h3 id="ai-plan-title" class="flex items-center gap-2 font-bold text-white">
                          <svg class="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/></svg>
                          {{ t('ai.plan.title') }}
                      </h3>
                      <template v-if="!aiPlan.result">
                          <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ t('ai.plan.intro') }}</p>
                          <label for="ai-plan-notes" class="label-xs mb-1.5 mt-3 block">{{ t('ai.plan.notesLabel') }}</label>
                          <textarea id="ai-plan-notes" v-model="aiPlan.notes" rows="3" maxlength="600" :placeholder="t('ai.plan.notesPlaceholder')"
                                    class="cyber-input w-full resize-none rounded-xl p-3 text-base" data-test="ai-plan-notes"></textarea>
                          <!-- Sekundär: die bewährten Vorlagen unten bleiben die Hauptaktion. Beim Laden nicht dimmen - der Fortschrittstext muss lesbar bleiben. -->
                          <button ref="aiPlanGenerate" type="button" @click="ai.generatePlan(a)" :disabled="aiPlan.busy || !deviceOnline" :aria-busy="aiPlan.busy"
                                  class="btn-secondary mt-3 flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold leading-tight" :class="aiPlan.busy ? '' : 'disabled:opacity-50'" data-test="ai-plan-generate">
                              <span v-if="aiPlan.busy" class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
                              {{ aiPlan.busy ? t('ai.plan.generating') : t('ai.plan.generate') }}
                          </button>
                          <p v-if="aiPlan.error" class="mt-2 text-xs text-red-300" role="alert" :data-error="aiPlan.error">{{ t(`ai.errors.${aiPlan.error}`) }}</p>
                      </template>
                      <template v-else>
                          <p ref="aiPlanName" tabindex="-1" class="mt-2 break-words text-lg font-bold leading-tight text-white outline-none" data-test="ai-plan-name">{{ aiPlan.result.program.name }}</p>
                          <p class="mt-1 font-mono text-[11px] text-slate-400">{{ goalName(aiPlan.result.program.goal) }} · {{ t('builder.perWeek', { n: aiPlan.result.program.days.length }) }} · {{ tn('units.weeks', aiPlan.result.program.weeks) }}</p>
                          <p v-if="aiPlan.result.summary" class="mt-2 text-sm leading-relaxed text-slate-200">{{ aiPlan.result.summary }}</p>
                          <ol class="mt-3 space-y-2">
                              <li v-for="(d, i) in aiPlan.result.program.days" :key="i" class="rounded-xl border border-white/5 bg-black/20 p-3">
                                  <p class="text-xs font-bold uppercase text-slate-300 tracking-label">{{ d.name }}</p>
                                  <ul class="mt-1.5 space-y-0.5">
                                      <li v-for="x in d.exercises" :key="x.exerciseId" class="text-sm text-slate-200">{{ prescription(x) }}</li>
                                  </ul>
                              </li>
                          </ol>
                          <p class="mt-3 text-[11px] text-slate-400">{{ t('ai.plan.review') }}</p>
                          <div class="mt-3 grid grid-cols-2 gap-2">
                              <button type="button" @click="ai.generatePlan(aiPlan.result.answers)" :disabled="aiPlan.busy || aiPlan.saving" :aria-busy="aiPlan.busy"
                                      class="btn-ghost flex min-h-[2.75rem] items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm leading-tight" :class="{ '!opacity-100': aiPlan.busy }" data-test="ai-plan-again">
                                  <span v-if="aiPlan.busy" class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
                                  {{ aiPlan.busy ? t('ai.plan.generating') : t('ai.plan.again') }}
                              </button>
                              <button type="button" @click="ai.acceptPlan()" :disabled="aiPlan.saving || aiPlan.busy" class="btn-primary min-h-[2.75rem] rounded-xl text-sm font-bold disabled:opacity-50" data-test="ai-plan-accept">{{ t('ai.plan.accept') }}</button>
                          </div>
                          <button type="button" @click="ai.discardPlan()" class="mt-2 min-h-[2.75rem] w-full text-xs font-bold text-slate-400 hover:text-white">{{ t('ai.plan.discard') }}</button>
                      </template>
                      <p class="mt-3 text-[11px] leading-snug text-slate-400">{{ t('ai.disclaimer') }}</p>
                  </section>

                  <h3 class="label-xs mb-2">{{ t('builder.results') }}</h3>
                  <p v-if="!online" class="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-slate-300">{{ t('plan.templatesOffline') }}</p>
                  <p v-else-if="!planChoices.length" class="rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-slate-300">{{ t('builder.empty') }}</p>
                  <ol v-else class="space-y-2">
                      <li v-for="(c, i) in planChoices" :key="c.template.key" class="rounded-2xl border p-4" :class="i === 0 ? 'border-accent/50 bg-accent/5' : 'border-white/10 bg-white/[0.03]'" :data-choice="c.template.key">
                          <div class="flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                  <p class="break-words font-bold leading-tight text-white">{{ templateText(c.template.key, 'name', c.template.name) }}</p>
                                  <p class="mt-1 font-mono text-[11px] text-slate-400">{{ goalName(c.template.goal) }} · {{ levelName(c.template.level) }} · {{ t('builder.perWeek', { n: c.template.sessionsPerWeek ?? c.template.days.length }) }} · {{ tn('units.weeks', c.template.weeks) }}</p>
                              </div>
                              <button type="button" @click="startPlanChoice(c.template)" :disabled="planBuilder.busy"
                                      class="min-h-[2.75rem] flex-shrink-0 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50" :class="i === 0 ? 'btn-primary' : 'btn-ghost'" :data-start-choice="c.template.key"
                                      :aria-label="`${t('builder.start')}: ${templateText(c.template.key, 'name', c.template.name)}`">{{ t('builder.start') }}</button>
                          </div>
                          <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{{ templateText(c.template.key, 'description', c.template.description) }}</p>
                      </li>
                  </ol>
              </div>
          </div>
      </div>
  </transition>
</template>
