<script setup lang="ts">
import { t } from '@/i18n';
import { exerciseName, categoryName } from '@/i18n/content';
import { onMounted, useTemplateRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore, heatTitle, workoutStats } from '@/stores/app';
import { formatDate, formatTime } from '@/lib/format';
import { groupSetsByExercise, workoutKey } from '@/lib/analytics';

const app = useAppStore();
const { activeDaysLast30, heatmap, kpis, selectedDay, selectedDayWorkouts } = storeToRefs(app);

// Neueste Wochen sichtbar machen (rechts)
const scroller = useTemplateRef<HTMLDivElement>('heatScroll');
onMounted(() => { if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth; });
</script>

<template>
  <div class="glass-panel rounded-3xl p-5">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
              <h3 class="font-black tracking-wide text-white">{{ t('calendar.title') }}</h3>
              <p class="font-mono text-[10px] text-slate-500">{{ t('calendar.info') }}</p>
          </div>
          <div class="flex items-center gap-1 font-mono text-[9px] text-slate-500">
              {{ t('calendar.less') }} <span class="heat-0 h-3 w-3 rounded-sm"></span><span class="heat-1 h-3 w-3 rounded-sm"></span><span class="heat-2 h-3 w-3 rounded-sm"></span><span class="heat-3 h-3 w-3 rounded-sm"></span><span class="heat-4 h-3 w-3 rounded-sm"></span> {{ t('calendar.more') }}
          </div>
      </div>
      <div ref="heatScroll" class="overflow-x-auto pb-2">
          <div class="inline-flex flex-col gap-1">
              <div class="relative ml-7 h-4 font-mono text-[9px] text-slate-500">
                  <span v-for="m in heatmap.months" :key="m.index" class="absolute" :style="{ left: (m.index * 16) + 'px' }">{{ m.label }}</span>
              </div>
              <div class="flex gap-1">
                  <div class="sticky left-0 z-10 mr-1 flex w-7 flex-col gap-1 bg-[#0c111c] font-mono text-[9px] text-slate-500">
                      <span class="h-3 leading-3">{{ t('calendar.weekdays.mo') }}</span><span class="h-3"></span><span class="h-3 leading-3">{{ t('calendar.weekdays.we') }}</span><span class="h-3"></span><span class="h-3 leading-3">{{ t('calendar.weekdays.fr') }}</span><span class="h-3"></span><span class="h-3 leading-3">{{ t('calendar.weekdays.su') }}</span>
                  </div>
                  <div v-for="(col, c) in heatmap.columns" :key="c" class="flex flex-col gap-1">
                      <button v-for="day in col" :key="day.date" :disabled="day.future" @click="selectedDay = day.sessions ? day.date : null" :title="heatTitle(day)"
                              class="h-3 w-3 rounded-sm transition-transform hover:scale-125 disabled:opacity-0"
                              :class="['heat-' + day.level, selectedDay === day.date ? 'ring-2 ring-white' : '']"></button>
                  </div>
              </div>
          </div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-3 border-t border-white/5 pt-4 text-center">
          <div><div class="stat-label">{{ t('calendar.activeDays') }}</div><div class="mt-1 font-mono text-lg font-black text-white">{{ activeDaysLast30 }}</div><div class="font-mono text-[9px] text-slate-500">{{ t('calendar.last30') }}</div></div>
          <div><div class="stat-label">{{ t('data.streak') }}</div><div class="mt-1 font-mono text-lg font-black text-white">{{ kpis.streak }}</div><div class="font-mono text-[9px] text-slate-500">{{ t('calendar.weeks') }}</div></div>
          <div><div class="stat-label">{{ t('calendar.workouts') }}</div><div class="mt-1 font-mono text-lg font-black text-white">{{ kpis.total }}</div><div class="font-mono text-[9px] text-slate-500">{{ t('calendar.allTime') }}</div></div>
      </div>
      <p v-if="!selectedDay" class="mt-4 text-center font-mono text-[10px] text-slate-500">{{ t('calendar.tapDay') }}</p>
      <div v-if="selectedDay" class="mt-4 space-y-2 border-t border-white/5 pt-4">
          <div class="text-[10px] font-bold uppercase tracking-widest text-accent">{{ formatDate(selectedDay, { weekday: 'long', day: '2-digit', month: 'long' }) }}</div>
          <div v-for="w in selectedDayWorkouts" :key="workoutKey(w)" class="rounded-xl border border-white/5 bg-black/20 p-3">
              <div class="flex justify-between text-sm font-bold text-white"><span>{{ categoryName(w.workoutType) }} · {{ formatTime(w.date) }}</span><span class="font-mono text-[10px] text-slate-500">{{ workoutStats(w) }}</span></div>
              <div class="mt-1 truncate font-mono text-[10px] text-slate-400">{{ groupSetsByExercise(w.sets).map(g => exerciseName(g.exerciseId, g.name)).join(', ') }}</div>
          </div>
      </div>
  </div>
</template>
