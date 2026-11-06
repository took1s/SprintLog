<script setup lang="ts">
// Kalender: Monat (Raster mit Belastung, Arten und Vorschau aus dem Wochenplan) und Jahr (12 Mini-Monate, Balken je Monat).
// Wischen wechselt den Monat bzw. das Jahr; ein Tag zeigt darunter seine Einheiten. Rechnen: lib/calendar.ts.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn, intlLocale } from '@/i18n';
import { exerciseName, categoryName } from '@/i18n/content';
import { useAppStore, workoutStats } from '@/stores/app';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import { groupSetsByExercise, workoutKey, dateKey } from '@/lib/analytics';
import { tap } from '@/lib/native';
import {
  indexByDay, levelOf, maxScoreOf, monthGrid, monthStats, plannedKind, sessionsPerMonth, yearStats, yearsWithData,
  type CalendarDay, type CalendarKind, type GridCell, type PeriodStats,
} from '@/lib/calendar';

const app = useAppStore();
const { allWorkouts, clockDate, activeProgram, selectedDay } = storeToRefs(app);

const view = ref<'month' | 'year'>('month');
const cursor = ref({ year: clockDate.value.getFullYear(), month: clockDate.value.getMonth() });
/** Richtung des letzten Wechsels - das Raster gleitet von dort herein. */
const dir = ref<'next' | 'prev'>('next');

const index = computed(() => indexByDay(allWorkouts.value));
const maxScore = computed(() => maxScoreOf(index.value));
const todayKey = computed(() => dateKey(clockDate.value));
const isCurrent = computed(() => view.value === 'month'
  ? cursor.value.year === clockDate.value.getFullYear() && cursor.value.month === clockDate.value.getMonth()
  : cursor.value.year === clockDate.value.getFullYear());

// ---------- Beschriftungen (Sprache der App) ----------
const monthName = (m: number, style: 'long' | 'short' = 'long') =>
  new Date(2026, m, 1).toLocaleDateString(intlLocale(), { month: style }).replace('.', '');
const title = computed(() => view.value === 'month' ? `${capitalize(monthName(cursor.value.month))} ${cursor.value.year}` : String(cursor.value.year));
const weekdays = computed(() => Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 9 + i).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '')));
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------- Monat ----------
const grid = computed(() => monthGrid(cursor.value.year, cursor.value.month));
const mStats = computed(() => monthStats(index.value, cursor.value.year, cursor.value.month));
const schedule = computed(() => activeProgram.value ?? null);

const dayOf = (cell: GridCell): CalendarDay | undefined => index.value.get(cell.key);
const planned = (cell: GridCell) => (cell.key > todayKey.value && cell.inMonth ? plannedKind(schedule.value, cell.date) : 'rest');

// Ausgeschriebene Klassennamen: Tailwind behält nur, was wörtlich im Code steht (heat-${n} würde entfernt)
const HEAT = ['heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4'] as const;
const heat = (day: CalendarDay | undefined) => HEAT[levelOf(day, maxScore.value)];

const KIND_DOT: Record<CalendarKind, string> = { Gym: 'bg-accent', Football: 'bg-emerald-400', Match: 'bg-yellow-400', Hybrid: 'bg-violet-400' };

function cellLabel(cell: GridCell) {
  const d = dayOf(cell);
  const date = formatDate(cell.date, { weekday: 'long', day: 'numeric', month: 'long' });
  if (d) return t('calendar.dayTitle', { date, summary: t('calendar.daySummary', { workouts: tn('units.workouts', d.sessions), sets: tn('units.sets', d.sets) }) });
  const p = planned(cell);
  return p === 'rest' ? date : `${date}: ${t(`calendar.planned.${p}`)}`;
}

function pick(cell: GridCell) {
  if (!cell.inMonth) {
    // Tag aus dem Nachbarmonat: dorthin wechseln und den Tag zeigen
    go(cell.date.getFullYear() * 12 + cell.date.getMonth() > cursor.value.year * 12 + cursor.value.month ? 1 : -1);
  }
  selectedDay.value = selectedDay.value === cell.key ? null : cell.key;
}

const selected = computed(() => (selectedDay.value ? index.value.get(selectedDay.value) ?? null : null));
const selectedDate = computed(() => (selectedDay.value ? new Date(`${selectedDay.value}T12:00:00`) : null));
const selectedPlan = computed(() => {
  if (!selectedDate.value || selectedDay.value! <= todayKey.value) return 'rest';
  return plannedKind(schedule.value, selectedDate.value);
});

// ---------- Jahr ----------
const yStats = computed(() => yearStats(index.value, cursor.value.year));
const perMonth = computed(() => sessionsPerMonth(index.value, cursor.value.year));
const maxPerMonth = computed(() => Math.max(1, ...perMonth.value));
const years = computed(() => yearsWithData(index.value, clockDate.value));
const miniMonths = computed(() => Array.from({ length: 12 }, (_, m) => ({
  month: m,
  cells: monthGrid(cursor.value.year, m),
  sessions: perMonth.value[m]!,
  current: cursor.value.year === clockDate.value.getFullYear() && m === clockDate.value.getMonth(),
  future: cursor.value.year > clockDate.value.getFullYear() || (cursor.value.year === clockDate.value.getFullYear() && m > clockDate.value.getMonth()),
})));

function openMonth(m: number) {
  dir.value = m >= cursor.value.month ? 'next' : 'prev';
  cursor.value = { year: cursor.value.year, month: m };
  view.value = 'month';
  tap();
}

// ---------- Navigation ----------
function go(step: number) {
  dir.value = step > 0 ? 'next' : 'prev';
  if (view.value === 'year') {
    cursor.value = { ...cursor.value, year: cursor.value.year + step };
  } else {
    const n = cursor.value.year * 12 + cursor.value.month + step;
    cursor.value = { year: Math.floor(n / 12), month: n % 12 };
  }
}

function goToday() {
  const now = clockDate.value;
  dir.value = now.getFullYear() * 12 + now.getMonth() >= cursor.value.year * 12 + cursor.value.month ? 'next' : 'prev';
  cursor.value = { year: now.getFullYear(), month: now.getMonth() };
  selectedDay.value = index.value.has(todayKey.value) ? todayKey.value : null;
}

function setView(v: 'month' | 'year') {
  if (view.value === v) return;
  view.value = v;
  tap();
}

// Ausgewählter Tag gehört nicht mehr zum sichtbaren Monat -> Details schließen
watch(cursor, () => {
  if (selectedDay.value && !selectedDay.value.startsWith(`${cursor.value.year}-${String(cursor.value.month + 1).padStart(2, '0')}`)) selectedDay.value = null;
});

// Wischen (horizontal) = blättern; vertikales Scrollen bleibt frei (touch-action: pan-y)
let start: { x: number; y: number } | null = null;
function swipeStart(e: PointerEvent) { start = { x: e.clientX, y: e.clientY }; }
function swipeEnd(e: PointerEvent) {
  if (!start) return;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;
  start = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { go(dx < 0 ? 1 : -1); tap(); }
}

// ---------- Kennzahlen ----------
function statItems(s: PeriodStats) {
  return [
    { key: 'sessions', value: String(s.sessions) },
    { key: 'activeDays', value: String(s.activeDays) },
    { key: 'minutes', value: formatNumber(s.minutes, 0) },
    { key: 'volume', value: s.volume ? formatNumber(s.volume, 0) : '–' },
    { key: 'matches', value: String(s.matches) },
    { key: 'bestStreak', value: String(s.bestStreak) },
  ] as const;
}
const stats = computed(() => statItems(view.value === 'month' ? mStats.value : yStats.value));
</script>

<template>
  <div class="glass-panel rounded-3xl p-4 sm:p-5" data-test="calendar">
      <!-- Kopf: Titel, Monat/Jahr, Blättern -->
      <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
              <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('calendar.kicker') }}</p>
              <h3 class="display mt-0.5 truncate text-2xl text-white" aria-live="polite" data-test="calendar-title">{{ title }}</h3>
          </div>
          <div class="flex flex-shrink-0 items-center gap-1">
              <button type="button" @click="go(-1)" class="cal-nav" :aria-label="view === 'month' ? t('calendar.prevMonth') : t('calendar.prevYear')" data-test="calendar-prev">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg>
              </button>
              <button type="button" @click="go(1)" class="cal-nav" :aria-label="view === 'month' ? t('calendar.nextMonth') : t('calendar.nextYear')" data-test="calendar-next">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
              </button>
          </div>
      </div>

      <div class="mt-3 flex items-center gap-2">
      <div class="grid flex-1 grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1" role="group" :aria-label="t('calendar.title')">
          <button v-for="v in (['month', 'year'] as const)" :key="v" type="button" @click="setView(v)" :aria-pressed="view === v" :data-test="`calendar-view-${v}`"
                  class="min-h-[2.5rem] rounded-xl text-xs font-bold uppercase tracking-label transition-colors"
                  :class="view === v ? 'bg-accent text-on-accent' : 'text-slate-300 hover:text-white'">{{ t(`calendar.views.${v}`) }}</button>
      </div>
      <button v-if="!isCurrent" type="button" @click="goToday" class="chip chip-idle min-h-[2.75rem] flex-shrink-0" data-test="calendar-today">{{ t('calendar.today') }}</button>
      </div>

      <!-- Kennzahlen des Zeitraums -->
      <dl class="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-6 sm:px-0" data-test="calendar-stats">
          <div v-for="s in stats" :key="s.key" class="min-w-[5.75rem] flex-shrink-0 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 sm:min-w-0">
              <dt class="truncate text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t(`calendar.stats.${s.key}`) }}</dt>
              <dd class="mt-0.5 font-mono text-lg font-black leading-none text-white tabular-nums" :data-stat="s.key">{{ s.value }}</dd>
          </div>
      </dl>

      <!-- ===== Monat ===== -->
      <div v-if="view === 'month'" class="mt-4">
          <div class="grid grid-cols-7 gap-1 pb-1.5 text-center text-[10px] font-bold uppercase text-slate-400 tracking-label" aria-hidden="true">
              <span v-for="w in weekdays" :key="w">{{ w }}</span>
          </div>
          <div class="cal-swipe overflow-hidden" @pointerdown="swipeStart" @pointerup="swipeEnd" @pointercancel="start = null">
              <transition :name="`cal-${dir}`" mode="out-in">
                  <div :key="`${cursor.year}-${cursor.month}`" class="grid grid-cols-7 gap-1" data-test="calendar-grid">
                      <button v-for="cell in grid" :key="cell.key" type="button" @click="pick(cell)"
                              class="cal-day" :class="[
                                  heat(dayOf(cell)),
                                  { 'is-out': !cell.inMonth, 'is-today': cell.key === todayKey, 'is-selected': selectedDay === cell.key,
                                    'is-strong': levelOf(dayOf(cell), maxScore) >= 3, 'is-planned': planned(cell) === 'training', 'is-planned-match': planned(cell) === 'match' }]"
                              :aria-label="cellLabel(cell)" :aria-pressed="selectedDay === cell.key" :aria-current="cell.key === todayKey ? 'date' : undefined"
                              :data-day="cell.key" :data-level="levelOf(dayOf(cell), maxScore)">
                          <span class="cal-num">{{ cell.date.getDate() }}</span>
                          <span v-if="dayOf(cell)" class="cal-dots" aria-hidden="true">
                              <i v-for="k in dayOf(cell)!.kinds" :key="k" :class="KIND_DOT[k]"></i>
                          </span>
                          <svg v-else-if="planned(cell) === 'match'" class="cal-ball" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8l3 2-1 4h-4l-1-4z" fill="currentColor"/></svg>
                      </button>
                  </div>
              </transition>
          </div>

          <!-- Legende -->
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-400">
              <span class="flex items-center gap-1">{{ t('calendar.legend.load') }}
                  <span v-for="l in 4" :key="l" class="h-2.5 w-2.5 rounded-[3px]" :class="HEAT[l]"></span>
              </span>
              <span class="flex items-center gap-1"><i class="h-1.5 w-1.5 rounded-full bg-accent"></i>{{ t('calendar.legend.gym') }}</span>
              <span class="flex items-center gap-1"><i class="h-1.5 w-1.5 rounded-full bg-emerald-400"></i>{{ t('calendar.legend.field') }}</span>
              <span class="flex items-center gap-1"><i class="h-1.5 w-1.5 rounded-full bg-yellow-400"></i>{{ t('calendar.legend.match') }}</span>
              <span v-if="schedule?.trainingDays || schedule?.matchDays" class="flex items-center gap-1"><i class="h-2.5 w-2.5 rounded-[3px] border border-dashed border-accent/70"></i>{{ t('calendar.legend.planned') }}</span>
          </div>

          <!-- Tag -->
          <div class="mt-4 border-t border-white/5 pt-4" data-test="calendar-day">
              <template v-if="selectedDay && selectedDate">
                  <p class="text-[11px] font-bold uppercase text-accent tracking-label">{{ formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
                  <ul v-if="selected" class="mt-2 space-y-2">
                      <li v-for="w in selected.workouts" :key="workoutKey(w)" class="rounded-2xl border border-white/5 bg-black/20 p-3" data-test="calendar-workout">
                          <div class="flex flex-col gap-0.5">
                              <span class="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
                                  <i class="h-2 w-2 flex-shrink-0 rounded-full" :class="KIND_DOT[(['Gym', 'Football', 'Hybrid', 'Match'].includes(w.workoutType) ? w.workoutType : 'Gym') as CalendarKind]" aria-hidden="true"></i>
                                  <span class="truncate">{{ categoryName(w.workoutType) }} · {{ formatTime(w.date) }}</span>
                              </span>
                              <span class="font-mono text-[10px] text-slate-400">{{ workoutStats(w) }}</span>
                          </div>
                          <p v-if="w.sets.length" class="mt-1 truncate font-mono text-[10px] text-slate-400">{{ groupSetsByExercise(w.sets).map((g) => exerciseName(g.exerciseId, g.name)).join(', ') }}</p>
                      </li>
                  </ul>
                  <p v-else-if="selectedPlan !== 'rest'" class="mt-2 text-sm text-slate-300">{{ t(`calendar.planned.${selectedPlan}`) }}</p>
                  <p v-else class="mt-2 text-sm text-slate-400">{{ t('calendar.noWorkouts') }}</p>
              </template>
              <p v-else-if="!mStats.sessions" class="text-center text-xs text-slate-400">{{ t('calendar.emptyMonth') }} {{ t('calendar.swipeHint') }}.</p>
              <p v-else class="text-center text-xs text-slate-400">{{ t('calendar.tapDay') }}</p>
          </div>
      </div>

      <!-- ===== Jahr ===== -->
      <div v-else class="mt-4 cal-swipe" @pointerdown="swipeStart" @pointerup="swipeEnd" @pointercancel="start = null">
          <transition :name="`cal-${dir}`" mode="out-in">
              <div :key="cursor.year">
                  <!-- Einheiten je Monat -->
                  <div class="flex h-20 items-end gap-1" data-test="calendar-bars">
                      <button v-for="(n, m) in perMonth" :key="m" type="button" @click="openMonth(m)" class="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                              :aria-label="t('calendar.openMonth', { month: capitalize(monthName(m)), count: tn('units.workouts', n) })">
                          <span class="font-mono text-[9px] text-slate-400 tabular-nums">{{ n || '' }}</span>
                          <span class="cal-bar w-full rounded-t-md" :class="n ? 'bg-accent' : 'bg-white/5'" :style="{ height: `${Math.max(4, (n / maxPerMonth) * 52)}px` }"></span>
                          <span class="text-[9px] font-bold uppercase text-slate-400 group-hover:text-white">{{ monthName(m, 'short').slice(0, 3) }}</span>
                      </button>
                  </div>

                  <p v-if="!yStats.sessions" class="mt-4 text-center text-xs text-slate-400">{{ t('calendar.emptyYear', { year: cursor.year }) }}</p>

                  <!-- 12 Mini-Monate -->
                  <div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" data-test="calendar-months">
                      <button v-for="mm in miniMonths" :key="mm.month" type="button" @click="openMonth(mm.month)"
                              class="cal-mini rounded-2xl border p-2 text-left transition-colors"
                              :class="[mm.current ? 'border-accent/60 bg-accent/5' : 'border-white/5 bg-white/[0.02] hover:border-white/20', { 'opacity-60': mm.future && !mm.sessions }]"
                              :aria-label="t('calendar.openMonth', { month: capitalize(monthName(mm.month)), count: tn('units.workouts', mm.sessions) })" :data-month="mm.month">
                          <span class="flex items-baseline justify-between gap-1">
                              <span class="truncate text-[11px] font-bold uppercase tracking-label" :class="mm.current ? 'text-accent' : 'text-slate-200'">{{ monthName(mm.month, 'short') }}</span>
                              <span v-if="mm.sessions" class="font-mono text-[10px] text-slate-400 tabular-nums">{{ mm.sessions }}</span>
                          </span>
                          <span class="mt-1.5 grid grid-cols-7 gap-[2px]" aria-hidden="true">
                              <i v-for="c in mm.cells" :key="c.key" class="aspect-square rounded-[2px]"
                                 :class="c.inMonth ? (c.key === todayKey ? 'cal-mini-today' : heat(index.get(c.key))) : 'opacity-0'"></i>
                          </span>
                      </button>
                  </div>

                  <!-- Schnell zu einem Jahr -->
                  <div v-if="years.length > 1" class="mt-4 flex flex-wrap gap-2">
                      <button v-for="y in years" :key="y" type="button" @click="dir = y > cursor.year ? 'next' : 'prev'; cursor = { ...cursor, year: y }"
                              class="min-h-[2.75rem]" :class="y === cursor.year ? 'chip chip-active' : 'chip chip-idle'" :aria-pressed="y === cursor.year">{{ y }}</button>
                  </div>
              </div>
          </transition>
      </div>
  </div>
</template>
