<script setup lang="ts">
// Мелкие дела дня одной строкой каждое: белок (быстрое добавление), тесты формы (когда пора), тренировка с часов
// без записи (Apple Health). Показывается только то, что актуально.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useAthleteStore } from '@/stores/athlete';
import { useHealthStore } from '@/stores/health';

const app = useAppStore();
const athlete = useAthleteStore();
const health = useHealthStore();
const { protein, due, testDay } = storeToRefs(athlete);

const proteinPct = computed(() => (protein.value.target ? Math.min(100, Math.round((protein.value.today / protein.value.target.goal) * 100)) : 0));
const testsDue = computed(() => due.value.state === 'due' || due.value.state === 'overdue' || due.value.state === 'none');
const watch = computed(() => health.offers[0] ?? null);
/** Training von der Uhr: erst RPE wählen, dann speichern. */
const askRpe = ref(false);
async function logTraining(rpe: number) {
  if (!watch.value) return;
  askRpe.value = false;
  await health.logAsTraining(watch.value, rpe);
}
function openAthlete() { app.tab = 'Data'; app.dataTab = 'athlete'; }
</script>

<template>
  <div class="mt-3 space-y-2" data-test="today-todo">
      <!-- Белок -->
      <div class="todo-row" data-test="todo-protein">
          <span class="todo-icon" aria-hidden="true">
              <svg viewBox="0 0 36 36" class="h-9 w-9 -rotate-90"><circle cx="18" cy="18" r="14" class="todo-ring-track" /><circle cx="18" cy="18" r="14" class="todo-ring-fill" :style="{ strokeDasharray: 88, strokeDashoffset: 88 * (1 - proteinPct / 100) }" /></svg>
          </span>
          <button type="button" class="min-w-0 flex-1 text-left" @click="openAthlete">
              <span class="block text-sm font-bold text-white">{{ t('body.protein') }}</span>
              <span class="block font-mono text-[11px] text-slate-400">{{ protein.today }}<template v-if="protein.target"> / {{ protein.target.goal }}</template> g</span>
          </button>
          <button type="button" class="protein-btn !min-h-[2.5rem] px-3" data-protein-quick @click="athlete.addProtein(30)">+30 g</button>
      </div>
      <!-- Тесты формы -->
      <button v-if="testsDue || testDay" type="button" class="todo-row w-full text-left" data-test="todo-tests" @click="athlete.openTestDay()">
          <span class="todo-icon is-gold" aria-hidden="true">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
          </span>
          <span class="min-w-0 flex-1">
              <span class="block text-sm font-bold text-white">{{ testDay ? t('testDay.resume') : due.state === 'none' ? t('tests.todoFirst') : t('tests.todoRetest') }}</span>
              <span class="block truncate text-[11px] text-slate-400">{{ testDay ? t('testDay.ctaHint') : due.state === 'none' ? t('tests.todoFirstHint') : t('tests.retest', { n: due.days! }) }}</span>
          </span>
          <span class="text-slate-400" aria-hidden="true">›</span>
      </button>
      <!-- Тренировка с часов без записи: как матч или как тренировка (с RPE) -->
      <div v-if="watch" class="todo-row flex-wrap" data-test="todo-watch">
          <span class="todo-icon is-red" aria-hidden="true">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8.2 3.3 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.7 5 21 8.2 19.5 11.7 17.5 16.4 12 21 12 21z"/></svg>
          </span>
          <span class="min-w-0 flex-1">
              <span class="block text-sm font-bold text-white">{{ t(`body.watchTitle.${watch.activity === 'soccer' || watch.activity === 'running' ? watch.activity : 'other'}`) }} · {{ Math.round(watch.durationSeconds / 60) }} {{ t('testDay.min') }}</span>
              <span class="block truncate text-[11px] text-slate-400">{{ new Date(watch.start).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }}<template v-if="watch.distanceM"> · {{ (watch.distanceM / 1000).toFixed(1) }} km</template><template v-if="watch.avgHr"> · ♥ {{ watch.avgHr }}</template></span>
          </span>
          <button type="button" class="h-9 w-9 flex-shrink-0 rounded-lg text-slate-500 hover:text-white" :aria-label="t('common.close')" @click="health.dismiss(watch)">✕</button>
          <div class="flex w-full gap-2 pl-12">
              <button v-if="watch.activity !== 'running'" type="button" class="btn-secondary flex-1 rounded-xl px-3 py-2 text-xs" data-test="watch-match" @click="health.logAsMatch(watch)">{{ t('body.logMatchShort') }}</button>
              <button type="button" class="btn-secondary flex-1 rounded-xl px-3 py-2 text-xs" :aria-expanded="askRpe" data-test="watch-training" @click="askRpe = !askRpe">{{ t('body.logTraining') }}</button>
          </div>
          <div v-if="askRpe" class="w-full pl-12" data-test="watch-rpe">
              <p class="mb-1.5 text-[11px] text-slate-400">{{ t('body.rpeAsk') }}</p>
              <div class="grid grid-cols-5 gap-1.5">
                  <button v-for="n in 10" :key="n" type="button" class="protein-btn !min-h-[2.5rem] px-0" :data-rpe="n" @click="logTraining(n)">{{ n }}</button>
              </div>
          </div>
      </div>
  </div>
</template>
