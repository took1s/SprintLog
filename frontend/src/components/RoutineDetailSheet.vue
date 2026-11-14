<script setup lang="ts">
// Routine im Detail: Fortschritt, Verlauf der letzten Wochen (Tage nachtragen oder korrigieren), Schritte, Bearbeiten.
// Ein Tipp auf einen Tag zählt einen Durchgang weiter (bei einmal täglich: erledigt <-> offen).
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { daysBetween, historyWeeks, parseDay, type HistoryCell } from '@/lib/routines';
import { vSheetDrag } from '@/lib/gestures';
import { tap as haptic } from '@/lib/native';
import RoutineMeta from './RoutineMeta.vue';
import RoutineStepRow from './RoutineStepRow.vue';

const app = useAppStore();
const routines = useRoutinesStore();
const { detailId, today } = storeToRefs(routines);

const r = computed(() => (detailId.value ? routines.byId(detailId.value) : null));
const p = computed(() => (r.value ? routines.progressOf(r.value) : null));
/** Verlauf ab Beginn der Routine, höchstens 5 Wochen (keine leeren Wochen vor dem Start). */
const weeks = computed(() => {
  if (!r.value) return [];
  const since = Math.floor(Math.max(0, daysBetween(r.value.startDate, today.value)) / 7) + 2;
  return historyWeeks(r.value, today.value, Math.min(5, since)).filter((w) => w.some((c) => c.state !== 'outside'));
});
const weekdays = computed(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(intlLocale(), { weekday: 'narrow' })));

const longDate = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
const editable = (c: HistoryCell) => c.state !== 'future' && c.state !== 'outside' && c.day <= today.value;

function cellLabel(c: HistoryCell) {
  const state = t(`routines.cell.${c.state}`);
  const times = r.value && r.value.timesPerDay > 1 ? ` (${c.count}/${r.value.timesPerDay})` : '';
  return `${longDate(c.day)}: ${state}${times}`;
}

/** Nächster Stand eines Tages: 0 -> 1 -> ... -> alle -> 0. */
function cycle(c: HistoryCell) {
  if (!r.value || !editable(c)) return;
  const next = c.count >= r.value.timesPerDay ? 0 : c.count + 1;
  routines.setCount(r.value.clientId, next, c.day);
  haptic();
}

function edit() {
  if (!r.value) return;
  const id = r.value.clientId;
  routines.closeDetail();
  routines.openEdit(id);
}
</script>

<template>
  <transition name="sheet">
      <div v-if="r && p" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="routines.closeDetail()" @keydown.esc.stop="routines.closeDetail()">
          <section v-sheet-drag:handle="() => routines.closeDetail()" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
                   role="dialog" aria-modal="true" aria-labelledby="routine-detail-title" data-test="routine-detail">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('routines.title') }}<template v-if="r.source === 'coach'"> · {{ t('routines.byCoach') }}</template></p>
                      <h2 id="routine-detail-title" class="display mt-1 break-words text-2xl leading-tight text-white">{{ r.title }}</h2>
                      <RoutineMeta :routine="r" class="mt-1" />
                  </div>
                  <button type="button" @click="routines.closeDetail()" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 overflow-y-auto px-6 pb-4">
                  <!-- Kennzahlen -->
                  <dl class="grid grid-cols-3 gap-2">
                      <div class="routine-stat">
                          <dt>{{ t('routines.stats.done') }}</dt>
                          <dd>{{ p.total ? `${p.done}/${p.total}` : p.done }}</dd>
                      </div>
                      <div class="routine-stat">
                          <dt>{{ t('routines.stats.adherence') }}</dt>
                          <dd>{{ p.adherence != null ? `${p.adherence}%` : '–' }}</dd>
                      </div>
                      <div class="routine-stat">
                          <dt>{{ t('routines.stats.streak') }}</dt>
                          <dd>{{ p.streak }}</dd>
                      </div>
                  </dl>

                  <!-- Verlauf -->
                  <div class="mt-5 flex items-baseline justify-between gap-2">
                      <p class="label-xs">{{ t('routines.history') }}</p>
                      <p class="text-[10px] text-slate-500">{{ t('routines.historyHint') }}</p>
                  </div>
                  <div class="mt-2 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase text-slate-500" aria-hidden="true">
                      <span v-for="(w, i) in weekdays" :key="i">{{ w }}</span>
                  </div>
                  <div class="mt-1 space-y-1.5" data-test="routine-history-grid">
                      <div v-for="(week, wi) in weeks" :key="wi" class="grid grid-cols-7 gap-1.5">
                          <button v-for="c in week" :key="c.day" type="button" class="routine-cell" :class="[`is-${c.state}`, { 'is-today': c.day === today }]"
                                  :disabled="!editable(c)" :aria-label="cellLabel(c)" :data-cell="c.day" :data-state="c.state" @click="cycle(c)">
                              <span class="routine-cell-num">{{ parseDay(c.day).getDate() }}</span>
                              <span v-if="r.timesPerDay > 1 && c.count > 0 && c.state !== 'done'" class="routine-cell-count">{{ c.count }}</span>
                          </button>
                      </div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span class="flex items-center gap-1"><i class="routine-legend is-done"></i>{{ t('routines.cell.done') }}</span>
                      <span v-if="r.timesPerDay > 1" class="flex items-center gap-1"><i class="routine-legend is-partial"></i>{{ t('routines.cell.partial') }}</span>
                      <span class="flex items-center gap-1"><i class="routine-legend is-missed"></i>{{ t('routines.cell.missed') }}</span>
                      <span class="flex items-center gap-1"><i class="routine-legend is-off"></i>{{ t('routines.cell.off') }}</span>
                  </div>

                  <!-- Schritte -->
                  <p class="label-xs mb-2 mt-5">{{ t('routines.sheet.steps') }}<template v-if="r.timesPerDay > 1"> · {{ tn('routines.timesPerDay', r.timesPerDay) }}</template></p>
                  <ol class="space-y-1.5">
                      <RoutineStepRow v-for="(s, i) in r.steps" :key="i" :index="i" boxed :name="s.name" :dose="s.dose" :exercise-id="s.exerciseId" @info="(id) => app.openExerciseInfo(id, 'overlay')" />
                  </ol>
                  <p v-if="r.reason" class="mt-3 text-sm leading-relaxed text-slate-300">{{ r.reason }}</p>
              </div>

              <div class="flex gap-2 border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button type="button" class="btn-primary flex-1 rounded-xl py-4 text-sm" data-test="routine-edit" @click="edit">{{ t('common.edit') }}</button>
              </div>
          </section>
      </div>
  </transition>
</template>
