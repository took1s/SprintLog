<script setup lang="ts">
// Start-Bildschirm: heute geplante Zusatz-Einheit (Starten, Verschieben, Auslassen), sonst die nächste in den kommenden
// 7 Tagen; dazu eine verpasste von gestern (nachholen = verschieben, oder auslassen). Keine Session aktiv: nur dann sichtbar.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { usePlannedStore } from '@/stores/planned';
import { addDays, daysBetween, parseDay } from '@/lib/routines';
import { prescriptionText, type PlannedWorkout } from '@/lib/planned';

const app = useAppStore();
const planned = usePlannedStore();
const { forToday, next, recent, today } = storeToRefs(planned);

// Ersatz für den heutigen Plan-Tag steht schon oben als Haupt-Knopf - nicht nochmal als "Дальше"
const soon = computed(() => (forToday.value.length ? null : next.value.find((p) => daysBetween(today.value, p.date) <= 7 && !(p.replacesPlan && p.date === today.value)) ?? null));
const missed = computed(() => recent.value.find((p) => p.status === 'planned' && p.date === addDays(today.value, -1)) ?? null);
const date = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'short' });

const summary = (p: PlannedWorkout) => p.exercises.slice(0, 4).map((x) => {
  const ex = app.exerciseFor(x.exerciseId);
  return `${exerciseName(ex ?? x.exerciseId)} ${prescriptionText(x, ex?.trackingType)}`;
}).join(' · ') + (p.exercises.length > 4 ? ' …' : '');
</script>

<template>
  <div v-if="forToday.length || soon || missed" class="mt-5 space-y-2">
      <section v-for="p in forToday" :key="p.clientId" class="planned-today rounded-2xl border p-4" data-test="planned-today" :data-planned="p.clientId">
          <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('planned.todayKicker') }}<template v-if="p.source === 'coach'"> · {{ t('planned.byCoach') }}</template></p>
          <h3 class="display mt-1 break-words text-xl leading-tight text-white">{{ p.title }}</h3>
          <p class="mt-1 text-xs leading-relaxed text-slate-300">{{ summary(p) }}</p>
          <p v-if="p.notes" class="mt-1 text-[11px] leading-snug text-slate-400">{{ p.notes }}</p>
          <!-- Starten volle Breite, darunter Verschieben/Auslassen nebeneinander - passt auch bei 320 px und langen Wörtern -->
          <div class="mt-3 grid grid-cols-2 gap-2">
              <button type="button" class="btn-primary col-span-2 rounded-xl py-3.5 text-sm" data-test="planned-start" @click="planned.start(p.clientId)">{{ t('planned.start') }}</button>
              <button type="button" class="btn-ghost min-w-0 rounded-xl px-2 py-3 text-xs" :title="t('planned.moveHint')" data-test="planned-move" @click="planned.move(p.clientId)">{{ t('planned.move') }}</button>
              <button type="button" class="btn-ghost min-w-0 rounded-xl px-2 py-3 text-xs" data-test="planned-skip" @click="planned.skip(p.clientId)">{{ t('planned.skip') }}</button>
          </div>
      </section>

      <div v-if="missed" class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3" data-test="planned-missed">
          <span class="routine-missed-dot" aria-hidden="true"></span>
          <p class="min-w-0 flex-1 break-words text-xs text-slate-300"><span class="font-bold text-white">{{ missed.title }}</span> · {{ t('planned.status.missed') }}</p>
          <span class="flex flex-shrink-0 flex-col gap-1.5 min-[400px]:flex-row">
              <button type="button" class="routine-link" @click="planned.move(missed.clientId)">{{ t('planned.move') }}</button>
              <button type="button" class="routine-link" @click="planned.skip(missed.clientId)">{{ t('planned.skip') }}</button>
          </span>
      </div>

      <button v-if="soon" type="button" class="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/5" data-test="planned-next" @click="planned.openEdit(soon.clientId)">
          <svg class="h-4 w-4 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path stroke-linecap="round" d="M8 3v4M16 3v4M3.5 10h17"/></svg>
          <span class="min-w-0 flex-1 truncate text-xs text-slate-300">{{ t('planned.next', { title: soon.title, date: date(soon.date) }) }}</span>
          <span class="flex-shrink-0 font-mono text-[10px] text-slate-500">{{ tn('planned.exercises', soon.exercises.length) }}</span>
      </button>
  </div>
</template>
