<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, zoneClass } from '@/stores/app';
import { formatRelative } from '@/lib/format';
import { prescriptionText } from '@/lib/program';

const app = useAppStore();
const { activeProgram, clockDate, expandedDay, loadInfo, loadZone, loadingPrograms, otherPrograms, programInfo, templates } = storeToRefs(app);
const { activateProgram, dayLabel, openProgramEditor, startProgramDay, startTemplate, stopProgram } = app;
</script>

<template>
  <section class="space-y-6">
      <div v-if="loadingPrograms" class="flex justify-center py-20">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
      </div>

      <template v-else>
          <!-- Aktiver Plan -->
          <div v-if="activeProgram && programInfo" class="glass-panel rounded-3xl border border-accent/30 p-5">
              <div class="mb-4 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                      <div class="text-[10px] font-bold uppercase tracking-widest text-accent">Active program · {{ activeProgram.goal }}</div>
                      <h2 class="break-words text-2xl font-black leading-tight text-white">{{ activeProgram.name }}</h2>
                      <div class="mt-1 font-mono text-[10px] text-slate-400">
                          Week {{ Math.min(programInfo.week, activeProgram.weeks) }} of {{ activeProgram.weeks }} · {{ programInfo.sessions }} sessions done
                          <template v-if="programInfo.lastDate"> · last {{ formatRelative(programInfo.lastDate, clockDate) }}</template>
                      </div>
                  </div>
                  <div class="flex flex-shrink-0 gap-2">
                      <button @click="openProgramEditor(activeProgram)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">Edit</button>
                      <button @click="stopProgram(activeProgram)" class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white">Pause</button>
                  </div>
              </div>
              <div class="mb-5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div class="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent" :style="{ width: Math.min(100, (programInfo.week - 1) / activeProgram.weeks * 100 + 4) + '%' }"></div>
              </div>
              <p v-if="programInfo.finished" class="mb-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-xs text-yellow-300">
                  Program completed 🎉 Restart it for another block or pick a new one below.
              </p>

              <!-- Nächster Tag -->
              <div v-if="programInfo.next" class="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
                  <div class="mb-1 flex items-center justify-between">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-accent">Next up</span>
                      <span class="font-mono text-[10px] text-slate-500">{{ dayLabel(programInfo.next) }}</span>
                  </div>
                  <h3 class="mb-3 text-xl font-black text-white">{{ programInfo.next.name }}</h3>
                  <ul class="mb-4 space-y-1">
                      <li v-for="x in programInfo.next.exercises" :key="x.id" class="flex justify-between gap-3 text-xs">
                          <span class="truncate text-slate-200">{{ x.exerciseName }}</span>
                          <span class="flex-shrink-0 font-mono text-[10px] text-slate-400">{{ prescriptionText(x) }}</span>
                      </li>
                  </ul>
                  <p v-if="programInfo.next.notes" class="mb-3 font-mono text-[10px] text-slate-500">{{ programInfo.next.notes }}</p>
                  <button @click="startProgramDay(programInfo.next)" class="cyber-btn w-full rounded-xl py-3 text-sm font-bold">Start {{ programInfo.next.name }}</button>
              </div>

              <!-- Alle Tage -->
              <div class="space-y-2">
                  <div v-for="day in activeProgram.days" :key="day.id" class="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                      <button @click="expandedDay = expandedDay === day.id ? null : day.id" class="flex w-full items-center justify-between px-4 py-3 text-left">
                          <span class="text-sm font-bold text-white">{{ day.name }} <span class="ml-2 font-mono text-[10px] font-normal text-slate-500">{{ day.exercises.length }} exercises</span></span>
                          <span class="font-mono text-[10px] text-slate-500">{{ dayLabel(day) }}</span>
                      </button>
                      <div v-if="expandedDay === day.id" class="border-t border-white/5 px-4 py-3">
                          <ul class="mb-3 space-y-1">
                              <li v-for="x in day.exercises" :key="x.id" class="flex justify-between gap-3 text-xs">
                                  <span class="truncate text-slate-300">{{ x.exerciseName }}</span>
                                  <span class="flex-shrink-0 font-mono text-[10px] text-slate-500">{{ prescriptionText(x) }}</span>
                              </li>
                          </ul>
                          <button @click="startProgramDay(day)" class="cyber-outline-btn w-full rounded-lg py-2 text-[10px] font-bold uppercase tracking-widest">Start this day</button>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Belastung -->
          <div class="glass-panel rounded-3xl p-5">
              <div class="mb-3 flex items-center justify-between">
                  <h3 class="font-black tracking-wide text-white">Training load</h3>
                  <span class="rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest" :class="zoneClass(loadZone.tone)">{{ loadZone.label }}</span>
              </div>
              <div class="mb-3 grid grid-cols-3 gap-3 text-center">
                  <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="stat-label">Acute 7d</div><div class="mt-1 font-mono text-lg font-black text-white">{{ loadInfo.acute }}</div></div>
                  <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="stat-label">Chronic / wk</div><div class="mt-1 font-mono text-lg font-black text-white">{{ loadInfo.chronic }}</div></div>
                  <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="stat-label">ACWR</div><div class="mt-1 font-mono text-lg font-black" :class="zoneClass(loadZone.tone).split(' ')[0]">{{ loadInfo.ratio ?? '--' }}</div></div>
              </div>
              <p class="text-xs text-slate-300">{{ loadZone.advice }}</p>
              <p class="mt-2 font-mono text-[9px] text-slate-500">Load = session RPE × minutes. {{ loadInfo.coverage.withRpe }}/{{ loadInfo.coverage.total }} sessions in the last 28 days are rated. Sweet spot 0.8-1.3.</p>
          </div>

          <!-- Vorlagen -->
          <div>
              <div class="mb-3 flex items-end justify-between">
                  <h3 class="font-black tracking-wide text-white">{{ activeProgram ? 'Other programs' : 'Start a program' }}</h3>
                  <button @click="openProgramEditor()" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">+ Custom</button>
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                  <div v-for="t in templates" :key="t.key" class="glass-panel flex flex-col rounded-2xl p-4">
                      <div class="mb-1 flex flex-wrap items-center gap-1.5">
                          <span class="rounded-md border border-accent/20 bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">{{ t.goal }}</span>
                          <span class="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{{ t.level }}</span>
                          <span class="font-mono text-[9px] text-slate-500">{{ t.days.length }} days · {{ t.weeks }} wk</span>
                      </div>
                      <h4 class="font-bold text-white">{{ t.name }}</h4>
                      <p class="mb-2 mt-1 flex-1 text-xs text-slate-400">{{ t.description }}</p>
                      <p class="mb-3 font-mono text-[10px] text-slate-500">{{ t.days.map(d => d.name).join(' · ') }}</p>
                      <button @click="startTemplate(t)" :disabled="activeProgram?.templateKey === t.key" class="cyber-btn rounded-xl py-2 text-xs font-bold">{{ activeProgram?.templateKey === t.key ? 'Active' : 'Start' }}</button>
                  </div>
              </div>
              <p v-if="!templates.length" class="glass-panel rounded-2xl p-6 text-center font-mono text-xs text-slate-500">Templates load when you are online.</p>
          </div>

          <!-- Eigene / pausierte Pläne -->
          <div v-if="otherPrograms.length">
              <h3 class="mb-3 font-black tracking-wide text-white">My programs</h3>
              <div class="space-y-2">
                  <div v-for="p in otherPrograms" :key="p.id" class="glass-panel flex items-center justify-between gap-3 rounded-2xl p-4">
                      <div class="min-w-0">
                          <div class="truncate font-bold text-white">{{ p.name }}</div>
                          <div class="font-mono text-[10px] text-slate-500">{{ p.goal }} · {{ p.days.length }} days · {{ p.weeks }} weeks{{ p.templateKey ? '' : ' · custom' }}</div>
                      </div>
                      <div class="flex flex-shrink-0 gap-2">
                          <button @click="activateProgram(p)" class="cyber-outline-btn rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest">Activate</button>
                          <button @click="openProgramEditor(p)" class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white">Edit</button>
                      </div>
                  </div>
              </div>
          </div>
      </template>
  </section>
</template>
