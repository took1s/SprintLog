<script setup lang="ts">
import { t, tn } from '@/i18n';
import { exerciseName, goalName, levelName, programName, dayName, dayNotes, noteText, templateText, templateDay } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore, zoneClass } from '@/stores/app';
import WellnessCard from '@/components/WellnessCard.vue';
import { formatNumber } from '@/lib/format';
import { formatRelative } from '@/lib/format';
import { cycleWeek, prescriptionText } from '@/lib/program';

const app = useAppStore();
const { activeProgram, clockDate, expandedDay, filteredTemplates, isDeloadNow, loadInfo, loadZone, loadingPrograms, otherPrograms, planWeek, programInfo, progressInPlan, templateFilter, templates } = storeToRefs(app);
const FILTERS = ['all', 'Football', 'Gym'] as const;
const { activateProgram, currentPrescription, dayLabel, openProgramEditor, startProgramDay, startTemplate, stopProgram } = app;
</script>

<template>
  <section class="space-y-6">
      <div v-if="loadingPrograms" class="flex justify-center py-20">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
      </div>

      <template v-else>
          <WellnessCard />

          <!-- Aktiver Plan -->
          <div v-if="activeProgram && programInfo" class="glass-panel rounded-3xl border border-accent/30 p-5">
              <div class="mb-4 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                      <div class="text-[10px] font-bold uppercase tracking-widest text-accent">{{ t('plan.activeProgram', { goal: goalName(activeProgram.goal) }) }}</div>
                      <h2 class="break-words text-2xl font-black leading-tight text-white">{{ programName(activeProgram) }}</h2>
                      <div class="mt-1 font-mono text-[10px] text-slate-400">
                          {{ t('plan.weekOf', { week: Math.min(programInfo.week, activeProgram.weeks), weeks: activeProgram.weeks }) }} · {{ tn('units.sessions', programInfo.sessions) }}
                          <template v-if="programInfo.lastDate"> · {{ t('plan.lastRelative', { when: formatRelative(programInfo.lastDate, clockDate) }) }}</template>
                          <template v-if="activeProgram.cycleWeeks"> · {{ t('plan.cycleWeek', { week: cycleWeek(activeProgram, planWeek), cycle: activeProgram.cycleWeeks }) }}</template>
                      </div>
                      <span v-if="isDeloadNow" class="mt-2 inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300" data-test="deload-badge">{{ t('plan.deloadWeek') }}</span>
                  </div>
                  <div class="flex flex-shrink-0 gap-2">
                      <button @click="openProgramEditor(activeProgram)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">{{ t('common.edit') }}</button>
                      <button @click="stopProgram(activeProgram)" class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white">{{ t('plan.pause') }}</button>
                  </div>
              </div>
              <div class="mb-5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div class="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent" :style="{ width: Math.min(100, (programInfo.week - 1) / activeProgram.weeks * 100 + 4) + '%' }"></div>
              </div>
              <p v-if="programInfo.finished" class="mb-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs text-yellow-300">
                  {{ t('plan.completed') }}
              </p>

              <!-- Nächster Tag -->
              <div v-if="programInfo.next" class="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
                  <div class="mb-1 flex items-center justify-between">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-accent">{{ t('plan.nextUp') }}</span>
                      <span class="font-mono text-[10px] text-slate-500">{{ dayLabel(programInfo.next) }}</span>
                  </div>
                  <h3 class="mb-3 text-xl font-black text-white">{{ dayName(activeProgram, programInfo.next) }}</h3>
                  <ul class="mb-4 space-y-1">
                      <li v-for="x in programInfo.next.exercises" :key="x.id" class="text-xs">
                          <div class="flex justify-between gap-3">
                              <span class="truncate text-slate-200">{{ exerciseName(x.exerciseId, x.exerciseName) }}</span>
                              <span class="flex-shrink-0 font-mono text-[10px] text-slate-400">{{ prescriptionText(currentPrescription(x)) }}</span>
                          </div>
                          <div v-if="currentPrescription(x).note" class="font-mono text-[9px] text-slate-500">{{ noteText(currentPrescription(x).note) }}</div>
                      </li>
                  </ul>
                  <p v-if="programInfo.next.notes" class="mb-3 font-mono text-[10px] text-slate-500">{{ dayNotes(activeProgram, programInfo.next) }}</p>
                  <button @click="startProgramDay(programInfo.next)" class="cyber-btn w-full rounded-xl py-3 text-sm font-bold">{{ t('plan.startDay', { name: dayName(activeProgram, programInfo.next) }) }}</button>
              </div>

              <!-- Fortschritt seit Start -->
              <div v-if="progressInPlan.length" class="mb-4 rounded-2xl border border-white/5 bg-black/20 p-4" data-test="plan-progress">
                  <div class="mb-2 flex items-baseline justify-between">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-accent">{{ t('plan.progressTitle') }}</span>
                      <span class="font-mono text-[9px] text-slate-500">{{ t('plan.progressInfo') }}</span>
                  </div>
                  <ul class="space-y-1">
                      <li v-for="p in progressInPlan" :key="p.exerciseId" class="flex justify-between gap-3 text-xs">
                          <span class="truncate text-slate-200">{{ exerciseName(p.exerciseId, p.name) }}</span>
                          <span class="flex-shrink-0 font-mono text-[10px]">
                              <span class="text-slate-400">{{ formatNumber(p.start, 1) }} → {{ formatNumber(p.current, 1) }} {{ t('units.kg') }}</span>
                              <span class="ml-2 font-bold" :class="p.change > 0 ? 'text-emerald-300' : p.change < 0 ? 'text-red-300' : 'text-slate-400'">{{ p.change > 0 ? '+' : '' }}{{ formatNumber(p.change, 1) }}%</span>
                          </span>
                      </li>
                  </ul>
              </div>

              <!-- Alle Tage -->
              <div class="space-y-2">
                  <div v-for="day in activeProgram.days" :key="day.id" class="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                      <button @click="expandedDay = expandedDay === day.id ? null : day.id" class="flex w-full items-center justify-between px-4 py-3 text-left">
                          <span class="text-sm font-bold text-white">{{ dayName(activeProgram, day) }} <span class="ml-2 font-mono text-[10px] font-normal text-slate-500">{{ tn('units.exercises', day.exercises.length) }}</span></span>
                          <span class="font-mono text-[10px] text-slate-500">{{ dayLabel(day) }}</span>
                      </button>
                      <div v-if="expandedDay === day.id" class="border-t border-white/5 px-4 py-3">
                          <ul class="mb-3 space-y-1">
                              <li v-for="x in day.exercises" :key="x.id" class="text-xs">
                                  <div class="flex justify-between gap-3">
                                      <span class="truncate text-slate-300">{{ exerciseName(x.exerciseId, x.exerciseName) }}</span>
                                      <span class="flex-shrink-0 font-mono text-[10px] text-slate-500">{{ prescriptionText(currentPrescription(x)) }}</span>
                                  </div>
                                  <div v-if="currentPrescription(x).note" class="font-mono text-[9px] text-slate-600">{{ noteText(currentPrescription(x).note) }}</div>
                              </li>
                          </ul>
                          <button @click="startProgramDay(day)" class="cyber-outline-btn w-full rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest">{{ t('plan.startThisDay') }}</button>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Belastung -->
          <div class="glass-panel rounded-3xl p-5">
              <div class="mb-3 flex items-center justify-between">
                  <h3 class="font-black tracking-wide text-white">{{ t('plan.trainingLoad') }}</h3>
                  <span class="rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest" :class="zoneClass(loadZone.tone)">{{ loadZone.label }}</span>
              </div>
              <div class="mb-3 grid grid-cols-3 gap-3 text-center">
                  <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="stat-label">{{ t('plan.acute') }}</div><div class="mt-1 font-mono text-lg font-black text-white">{{ loadInfo.acute }}</div></div>
                  <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="stat-label">{{ t('plan.chronic') }}</div><div class="mt-1 font-mono text-lg font-black text-white">{{ loadInfo.chronic }}</div></div>
                  <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="stat-label">{{ t('plan.acwr') }}</div><div class="mt-1 font-mono text-lg font-black" :class="zoneClass(loadZone.tone).split(' ')[0]">{{ loadInfo.ratio ?? '--' }}</div></div>
              </div>
              <p class="text-xs text-slate-300">{{ loadZone.advice }}</p>
              <p class="mt-2 font-mono text-[9px] text-slate-500">{{ t('plan.loadInfo', { rated: loadInfo.coverage.withRpe, total: loadInfo.coverage.total }) }}</p>
          </div>

          <!-- Vorlagen -->
          <div>
              <div class="mb-3 flex items-end justify-between">
                  <h3 class="font-black tracking-wide text-white">{{ activeProgram ? t('plan.otherPrograms') : t('plan.startProgram') }}</h3>
                  <button @click="openProgramEditor()" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">{{ t('plan.newCustom') }}</button>
              </div>
              <div class="mb-3 flex gap-2" role="radiogroup">
                  <button v-for="f in FILTERS" :key="f" type="button" role="radio" :aria-checked="templateFilter === f" @click="templateFilter = f"
                          class="chip" :class="templateFilter === f ? 'chip-active' : 'chip-idle'">{{ t(`plan.filter.${f}`) }}</button>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                  <div v-for="tpl in filteredTemplates" :key="tpl.key" class="glass-panel flex min-w-0 flex-col rounded-2xl p-4" :data-template="tpl.key">
                      <div class="mb-1 flex flex-wrap items-center gap-1.5">
                          <span class="rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">{{ goalName(tpl.goal) }}</span>
                          <span class="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{{ levelName(tpl.level) }}</span>
                          <span class="font-mono text-[9px] text-slate-500">{{ t('plan.perWeek', { n: tpl.daysPerWeek ?? tpl.days.length }) }} · {{ tn('units.weeks', tpl.weeks) }}</span>
                      </div>
                      <h4 class="font-bold text-white">{{ templateText(tpl.key, 'name', tpl.name) }}</h4>
                      <p class="mb-2 mt-1 flex-1 text-xs text-slate-400">{{ templateText(tpl.key, 'description', tpl.description) }}</p>
                      <p class="mb-2 font-mono text-[10px] text-slate-500">{{ tpl.days.map((d, i) => templateDay(tpl.key, i, 'name', d.name)).join(' · ') }}</p>
                      <div v-if="tpl.sources?.length" class="mb-3 space-y-0.5">
                          <a v-for="src in tpl.sources" :key="src.url" :href="src.url" target="_blank" rel="noopener noreferrer"
                             class="block truncate font-mono text-[9px] text-accent/70 underline decoration-dotted hover:text-accent">{{ t('plan.sources') }}: {{ src.title }}</a>
                      </div>
                      <button @click="startTemplate(tpl)" :disabled="activeProgram?.templateKey === tpl.key" class="cyber-btn rounded-xl py-2 text-xs font-bold">{{ activeProgram?.templateKey === tpl.key ? t('plan.active') : t('common.start') }}</button>
                  </div>
              </div>
              <p v-if="!templates.length" class="glass-panel rounded-2xl p-6 text-center font-mono text-xs text-slate-500">{{ t('plan.templatesOffline') }}</p>
          </div>

          <!-- Eigene / pausierte Pläne -->
          <div v-if="otherPrograms.length">
              <h3 class="mb-3 font-black tracking-wide text-white">{{ t('plan.myPrograms') }}</h3>
              <div class="space-y-2">
                  <div v-for="p in otherPrograms" :key="p.id" class="glass-panel flex items-center justify-between gap-3 rounded-2xl p-4">
                      <div class="min-w-0">
                          <div class="truncate font-bold text-white">{{ programName(p) }}</div>
                          <div class="font-mono text-[10px] text-slate-500">{{ goalName(p.goal) }} · {{ tn('units.days', p.days.length) }} · {{ tn('units.weeks', p.weeks) }}{{ p.templateKey ? '' : ` · ${t('plan.customTag')}` }}</div>
                      </div>
                      <div class="flex flex-shrink-0 gap-2">
                          <button @click="activateProgram(p)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">{{ t('plan.activate') }}</button>
                          <button @click="openProgramEditor(p)" class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white">{{ t('common.edit') }}</button>
                      </div>
                  </div>
              </div>
          </div>
      </template>
  </section>
</template>
