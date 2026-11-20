<script setup lang="ts">
// Wochenbericht auf dem Startbildschirm - sonntags die laufende Woche, montags die abgeschlossene: Einheiten, Plan-Tage,
// Routinen, Belastung zur Vorwoche, Tagesbalken, Reha-Schmerz. "Mit dem Coach auswerten" schickt die Zahlen an den Coach
// (Analyse + Plan für die nächste Woche per Karten). Ausblenden gilt für diese Woche.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { usePlannedStore } from '@/stores/planned';
import { useAiStore } from '@/stores/ai';
import { useRemindersStore } from '@/stores/reminders';
import { parseDay } from '@/lib/routines';
import { reportFacts, reportWeekStart, weekReport } from '@/lib/weekReport';
import { readJson, writeJson } from '@/lib/storage';

const app = useAppStore();
const routines = useRoutinesStore();
const planned = usePlannedStore();
const ai = useAiStore();
const reminders = useRemindersStore();
const { today } = storeToRefs(routines);

const HIDDEN_KEY = 'sprintlog:report-hidden';
const hidden = ref<string | null>(readJson<string | null>(HIDDEN_KEY, null));
const monday = computed(() => reportWeekStart(today.value));
const report = computed(() => (monday.value ? weekReport({
  today: today.value, workouts: app.allWorkouts, schedule: app.activeProgram ?? null, routines: routines.routines, planned: planned.items,
}, monday.value) : null));
const visible = computed(() => !!report.value && hidden.value !== monday.value);
const isLast = computed(() => !!report.value && report.value.to < today.value);

const fmt = (day: string, withMonth = true) => parseDay(day).toLocaleDateString(intlLocale(), withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
const range = computed(() => (report.value ? `${fmt(report.value.from, report.value.from.slice(5, 7) !== report.value.to.slice(5, 7))} – ${fmt(report.value.to)}` : ''));
const weekday = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'narrow' });

/** Kurz sichtbar (↑2 / ↓1 / =), ausführlich für Screenreader. */
function delta(now: number, before: number): { short: string; text: string; tone: 'up' | 'down' | null } {
  const d = now - before;
  if (d === 0) return { short: '=', text: t('report.samePrev'), tone: null };
  return { short: `${d > 0 ? '↑' : '↓'}${Math.abs(d)}`, text: t('report.vsPrev', { delta: `${d > 0 ? '+' : '−'}${Math.abs(d)}` }), tone: d > 0 ? 'up' : 'down' };
}
const sessionsDelta = computed(() => (report.value ? delta(report.value.sessions, report.value.prevSessions) : null));
const maxLoad = computed(() => Math.max(1, ...(report.value?.days.map((d) => Math.max(d.load, d.minutes, d.sessions * 30)) ?? [1])));
const barHeight = (d: { load: number; minutes: number; sessions: number }) =>
  d.sessions ? `${Math.max(18, Math.round((Math.max(d.load, d.minutes, d.sessions * 30) / maxLoad.value) * 100))}%` : '8%';

function hide() {
  hidden.value = monday.value;
  writeJson(HIDDEN_KEY, monday.value);
}

function askCoach() {
  const r = report.value;
  if (!r) return;
  void ai.askFromElsewhere(`${t('report.prompt', { from: fmt(r.from), to: fmt(r.to) })}\n\n${reportFacts(r)}`, 'deep');
}

// Erinnerung "Wochenbericht" angetippt: Karte wieder zeigen und hinscrollen
const root = ref<HTMLElement | null>(null);
watch(() => reminders.focus, (f) => {
  if (f?.kind !== 'report' || !monday.value) return;
  hidden.value = null;
  window.setTimeout(() => root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
});
</script>

<template>
  <section v-if="visible && report" ref="root" class="report-card mt-5 rounded-2xl border p-4" data-test="week-report" aria-labelledby="week-report-title">
      <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
              <p class="text-tiny font-bold caps tracking-label text-amber-300">{{ range }}</p>
              <h3 id="week-report-title" class="display mt-0.5 text-xl leading-tight text-white">{{ isLast ? t('report.titleLast') : t('report.title') }}</h3>
          </div>
          <button type="button" class="-mr-2 -mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 hover:text-white" :aria-label="t('report.hide')" data-test="week-report-hide" @click="hide">✕</button>
      </div>

      <dl class="mt-3 grid grid-cols-3 gap-2">
          <div class="report-stat">
              <dt>{{ t('report.sessions') }}</dt>
              <dd data-test="report-sessions" class="flex items-baseline gap-1.5">{{ report.sessions }}
                  <span v-if="sessionsDelta" class="report-delta" :class="sessionsDelta.tone ? `is-${sessionsDelta.tone}` : 'text-slate-500'" :title="sessionsDelta.text">
                      <span aria-hidden="true">{{ sessionsDelta.short }}</span><span class="sr-only">{{ sessionsDelta.text }}</span>
                  </span>
              </dd>
          </div>
          <div class="report-stat">
              <dt>{{ t('report.plan') }}</dt>
              <dd>{{ report.planDays ? `${report.planDays.done}/${report.planDays.total}` : '–' }}</dd>
              <p v-if="report.matches" class="report-delta text-slate-400">{{ tn('report.matches', report.matches) }}</p>
          </div>
          <div class="report-stat">
              <dt>{{ t('report.routines') }}</dt>
              <dd>{{ report.routines.pct != null ? `${report.routines.pct}%` : '–' }}</dd>
              <p v-if="report.routines.due" class="report-delta text-slate-400">{{ report.routines.done }}/{{ report.routines.due }}</p>
          </div>
      </dl>

      <div class="mt-3" role="img" :aria-label="`${t('report.days')}: ${report.days.map((d) => `${weekday(d.day)} ${d.sessions}`).join(', ')}`">
          <div class="report-bars" aria-hidden="true">
              <span v-for="(d, i) in report.days" :key="d.day" class="report-bar" :class="{ 'is-active': d.sessions > 0 && !d.match, 'is-match': d.match }"
                    :style="{ height: barHeight(d), animationDelay: `${120 + i * 45}ms` }"></span>
          </div>
          <div class="mt-1 grid grid-cols-7 gap-1.5 text-center text-micro font-bold caps text-slate-500" aria-hidden="true">
              <span v-for="d in report.days" :key="d.day">{{ weekday(d.day) }}</span>
          </div>
      </div>

      <ul v-if="report.rehab.length || report.extras.done + report.extras.missed > 0" class="mt-3 space-y-1 text-xs text-slate-300">
          <li v-if="report.extras.done + report.extras.missed > 0">{{ t('report.extras', { done: report.extras.done, missed: report.extras.missed }) }}</li>
          <li v-for="x in report.rehab.filter((x) => x.latest != null)" :key="x.title" class="break-words">
              {{ t('report.rehab', { title: x.title, n: x.latest! }) }}<template v-if="x.trend"> · <span :class="x.trend === 'falling' ? 'text-emerald-300' : x.trend === 'rising' ? 'text-red-300' : 'text-slate-400'">{{ t(`report.trend.${x.trend}`) }}</span></template>
          </li>
      </ul>
      <p v-if="!report.sessions" class="mt-3 text-xs text-slate-400">{{ t('report.empty') }}</p>

      <button v-if="ai.enabled" type="button" class="btn-secondary mt-4 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left" data-test="week-report-ask" @click="askCoach">
          <span class="min-w-0">
              <span class="block text-sm font-bold">{{ t('report.ask') }}</span>
              <span class="block truncate text-[11px] font-normal text-slate-400">{{ t('report.askHint') }}</span>
          </span>
          <span aria-hidden="true">→</span>
      </button>
  </section>
</template>
