<script setup lang="ts">
// "Plan für mich": vier Fragen, live die drei passendsten Vorlagen - Start übernimmt Programm UND Wochenplan.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn, intlLocale } from '@/i18n';
import { goalName, levelName, templateText } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { WEEKDAYS } from '@/lib/schedule';
import type { PlanFocus, PlanLevel } from '@/lib/planBuilder';

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
</script>

<template>
  <transition name="fade">
      <div v-if="planBuilder.open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="close">
          <div class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="t('builder.title')" data-test="plan-builder">
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
