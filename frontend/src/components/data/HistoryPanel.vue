<script setup lang="ts">
// Verlauf: Wochen mit Kennzahlen (Einheiten, Zeit, Trainingslast), darunter kompakte Karten je Einheit -
// Datum, Titel (Plan-Tag / Gegner mit Ergebnis), Eckdaten und Abzeichen (Rekorde, Uhr, Sync). Antippen klappt die
// Details auf: Übungen mit Sätzen als Chips, Notizen, Spiel, Uhr-Werte und Aktionen. Neueste Einheit ist offen.
// Suche über Übungen, Gegner, Notizen und Studio; Filter mit Anzahl.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { exerciseName, categoryName } from '@/i18n/content';
import { useAppStore, rpeText, sessionRpeLabel, setLabel, workoutStats } from '@/stores/app';
import { describeSet, formatDuration, formatTime } from '@/lib/format';
import { groupSetsByExercise, workoutKey } from '@/lib/analytics';
import { groupByWeek, matchesSearch, mondayOf } from '@/lib/historyGroups';
import type { TeamFocus, TeamParticipation, Workout } from '@/types';
import type { Position } from '@/lib/fitnessTests';

const FILTERS = ['all', 'Gym', 'Football', 'Team', 'Match', 'Hybrid'] as const;
const app = useAppStore();
const { allWorkouts, failedCount, filteredHistory, historyFilter, historyLimit, pendingCount, settings, syncing } = storeToRefs(app);
const { deleteWorkout, editWorkout, openObsidian, programNameForDay, repeatWorkout, retryEntry, setBadges, syncNow } = app;

// ---------- Suche, Filter, Wochen ----------
const query = ref('');
const counts = computed(() => {
  const c: Record<string, number> = { all: allWorkouts.value.length };
  for (const w of allWorkouts.value) c[w.workoutType] = (c[w.workoutType] ?? 0) + 1;
  return c;
});
const matching = computed(() => (query.value.trim() ? filteredHistory.value.filter((w) => matchesSearch(w, query.value, (id, name) => exerciseName(id, name))) : filteredHistory.value));
const shown = computed(() => matching.value.slice(0, historyLimit.value));
const weeks = computed(() => groupByWeek(shown.value));
const thisWeek = computed(() => mondayOf(app.clockDate).getTime());
function weekTitle(start: Date, end: Date): string {
  const diff = Math.round((thisWeek.value - start.getTime()) / (7 * 86_400_000));
  const range = `${start.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })}`;
  if (diff === 0) return `${t('history.thisWeek')} · ${range}`;
  if (diff === 1) return `${t('history.lastWeek')} · ${range}`;
  return range;
}
const hm = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)} ${t('history.h')} ${String(minutes % 60).padStart(2, '0')}` : `${minutes} ${t('history.min')}`);
function setFilter(f: (typeof FILTERS)[number]) { historyFilter.value = f; historyLimit.value = 20; }

// ---------- Aufklappen: neueste Einheit offen; neu gespeicherte öffnen sich ----------
const open = ref<Set<string>>(new Set());
const firstKey = computed(() => (allWorkouts.value[0] ? workoutKey(allWorkouts.value[0]) : null));
watch(firstKey, (k) => { if (k) open.value = new Set([...open.value, k]); }, { immediate: true });
const isOpen = (w: Workout) => open.value.has(workoutKey(w));
function toggle(w: Workout) {
  const k = workoutKey(w);
  const next = new Set(open.value);
  if (next.has(k)) next.delete(k); else next.add(k);
  open.value = next;
}

// ---------- Inhalt einer Karte ----------
const type = (w: Workout) => (({ Gym: 'gym', Football: 'football', Match: 'match', Hybrid: 'hybrid', Team: 'team' } as Record<string, string>)[w.workoutType] ?? 'football');
function title(w: Workout): string {
  if (w.workoutType === 'Match') return w.match?.opponent ? t('match.vs', { opponent: w.match.opponent }) : t('categories.Match');
  if (w.workoutType === 'Team') return t('team.historyTitle');
  const plan = w.programDayId ? programNameForDay(w.programDayId) : null;
  return plan ?? categoryName(w.workoutType);
}
const score = (w: Workout) => (w.match?.teamGoals != null && w.match?.opponentGoals != null ? `${w.match.teamGoals}:${w.match.opponentGoals}` : null);
const result = (w: Workout) => { const s = score(w); if (!s) return null; const a = w.match!.teamGoals!, b = w.match!.opponentGoals!; return a > b ? 'win' : a < b ? 'loss' : 'draw'; };
const prCount = (w: Workout) => w.sets.reduce((n, _s, i) => n + (setBadges(w, i).length ? 1 : 0), 0);
const day = (w: Workout) => new Date(w.date);

function noteOf(w: Workout, exerciseId: number | null): string {
  const n = w.exerciseNotes?.find((x) => x.exerciseId === exerciseId);
  if (!n) return '';
  return [n.skipped ? t('exnote.skipped') : '', n.pain != null ? t('exnote.painValue', { n: n.pain }) : '', n.reason ? t(`exnote.reasons.${n.reason}`) : '', n.note ?? ''].filter(Boolean).join(' · ');
}
const skippedOf = (w: Workout) => (w.exerciseNotes ?? []).filter((n) => !w.sets.some((s) => s.exerciseId === n.exerciseId));
const kmh = (v: number) => v.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
</script>

<template>
  <div class="space-y-4">
      <!-- Nicht gesendete Einheiten deutlich zeigen: Sie existieren nur auf diesem Gerät. -->
      <div v-if="pendingCount || failedCount" role="status" data-testid="unsent-banner"
           class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/40 bg-orange-400/10 p-4">
          <div class="min-w-0 text-xs font-bold text-orange-200">
              <p v-if="pendingCount">{{ tn('history.unsent', pendingCount) }}</p>
              <p v-if="failedCount" class="text-red-300">{{ tn('history.unsentFailed', failedCount) }}</p>
          </div>
          <button v-if="pendingCount" @click="syncNow()" :disabled="syncing"
                  class="cyber-outline-btn rounded-xl px-4 py-2 text-tiny font-bold caps tracking-widest disabled:opacity-40">
              {{ syncing ? t('settings.syncing') : t('history.sendNow') }}
          </button>
      </div>

      <!-- Suche und Filter -->
      <div class="space-y-2">
          <label class="hist-search">
              <svg class="h-4 w-4 flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/></svg>
              <input v-model="query" type="search" class="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" :placeholder="t('history.search')" :aria-label="t('history.search')" data-test="history-search">
              <button v-if="query" type="button" class="-mr-1 h-8 w-8 flex-shrink-0 rounded-lg text-slate-400 hover:text-white" :aria-label="t('common.clear')" @click="query = ''">✕</button>
          </label>
          <div class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" :aria-label="t('history.filter')">
              <button v-for="f in FILTERS" :key="f" type="button" role="radio" :aria-checked="historyFilter === f" class="hist-chip" :class="[historyFilter === f ? 'is-on' : '', f !== 'all' ? `is-${type({ workoutType: f } as Workout)}` : '']" :data-filter="f" @click="setFilter(f)">
                  <i v-if="f !== 'all'" class="hist-chip-dot" aria-hidden="true"></i>
                  {{ f === 'all' ? t('common.all') : categoryName(f) }}
                  <span class="font-mono opacity-60">{{ counts[f] ?? 0 }}</span>
              </button>
          </div>
      </div>

      <!-- Wochen -->
      <section v-for="week in weeks" :key="week.key" :aria-label="weekTitle(week.start, week.end)" data-test="history-week">
          <header class="hist-week">
              <h3>{{ weekTitle(week.start, week.end) }}</h3>
              <p class="font-mono">
                  {{ tn('history.sessions', week.workouts.length) }}<template v-if="week.minutes"> · {{ hm(week.minutes) }}</template><template v-if="week.load"> · {{ t('history.loadShort', { n: week.load }) }}</template>
              </p>
          </header>
          <ol class="space-y-2">
              <li v-for="w in week.workouts" :key="workoutKey(w)">
                  <article class="hist-card" :class="[`is-${type(w)}`, { 'is-open': isOpen(w) }]">
                      <button type="button" class="hist-head" :aria-expanded="isOpen(w)" data-test="history-toggle" @click="toggle(w)">
                          <span class="hist-date" aria-hidden="true">
                              <span class="text-tiny font-bold caps">{{ day(w).toLocaleDateString(intlLocale(), { weekday: 'short' }) }}</span>
                              <span class="font-mono text-xl font-black leading-none">{{ day(w).getDate() }}</span>
                          </span>
                          <span class="min-w-0 flex-1">
                              <span class="flex items-center gap-2">
                                  <span class="truncate text-sm font-bold text-white">{{ title(w) }}</span>
                                  <span v-if="score(w)" class="hist-score" :class="`is-${result(w)}`">{{ score(w) }}</span>
                              </span>
                              <span class="mt-0.5 block truncate font-mono text-[11px] text-slate-400">{{ formatTime(w.date) }}<template v-if="w.durationSeconds && w.workoutType !== 'Match'"> · {{ formatDuration(w.durationSeconds) }}</template> · {{ workoutStats(w) }}</span>
                              <span class="mt-1 flex flex-wrap gap-1">
                                  <span class="hist-tag is-type">{{ categoryName(w.workoutType) }}</span>
                                  <span v-if="w.sessionRpe" class="hist-tag">RPE {{ w.sessionRpe }}</span>
                                  <span v-if="prCount(w)" class="hist-tag is-pr">🏆 {{ tn('history.prs', prCount(w)) }}</span>
                                  <span v-if="w.health?.avgHr" class="hist-tag">♥ {{ w.health.avgHr }}</span>
                                  <span v-if="w.pending && w.status === 'failed'" class="hist-tag is-error" :title="w.error ?? undefined">{{ t('history.syncFailed') }}</span>
                                  <span v-else-if="w.pending" class="hist-tag is-pending">{{ w.op === 'update' ? t('history.editPending') : t('history.pendingSync') }}</span>
                              </span>
                          </span>
                          <svg class="mt-1 h-4 w-4 flex-shrink-0 text-slate-500 transition-transform duration-200" :class="{ 'rotate-90': isOpen(w) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
                      </button>

                      <transition name="expand">
                          <div v-if="isOpen(w)" class="expand-wrap">
                              <div class="hist-body">
                                  <!-- Kontext: Studio, sRPE, Qualität -->
                                  <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                      <span v-if="w.gym" class="flex items-center gap-1" data-test="history-gym">
                                          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>{{ w.gym }}
                                      </span>
                                      <span v-if="w.sessionRpe">{{ t('history.srpe', { value: w.sessionRpe, label: sessionRpeLabel(w.sessionRpe) }) }}</span>
                                      <span v-if="w.quality" class="text-emerald-300">{{ t('history.quality', { value: w.quality }) }}</span>
                                  </div>

                                  <!-- Spiel -->
                                  <div v-if="w.workoutType === 'Match'" class="mt-3 space-y-2" data-test="match-summary">
                                      <div class="flex flex-wrap items-center gap-2 text-sm">
                                          <span v-if="w.match?.opponent" class="sr-only">{{ t('match.vs', { opponent: w.match.opponent }) }}</span>
                                          <span v-if="w.match?.position" class="hist-tag">{{ t(`ai.profile.positions.${w.match.position as Position}`) }}</span>
                                          <span v-if="w.match?.goals || w.match?.assists" class="hist-tag is-pr">{{ t('match.goalsAssists', { goals: w.match?.goals ?? 0, assists: w.match?.assists ?? 0 }) }}</span>
                                      </div>
                                      <p v-if="w.match?.wentWell" class="text-xs leading-snug text-slate-300"><span class="font-bold text-emerald-300">+</span> {{ w.match.wentWell }}</p>
                                      <p v-if="w.match?.toImprove" class="text-xs leading-snug text-slate-300"><span class="font-bold text-amber-300">→</span> {{ w.match.toImprove }}</p>
                                  </div>

                                  <!-- Mannschaftstraining -->
                                  <div v-else-if="w.workoutType === 'Team'" class="mt-3 flex flex-wrap items-center gap-2 text-sm" data-test="team-summary">
                                      <span v-if="w.team?.focus" class="hist-tag">{{ t(`team.foci.${w.team.focus as TeamFocus}`) }}</span>
                                      <span v-if="w.team?.participation && w.team.participation !== 'full'" class="hist-tag">{{ t(`team.parts.${w.team.participation as TeamParticipation}`) }}</span>
                                  </div>

                                  <!-- Übungen: Sätze als Chips -->
                                  <ul v-else class="mt-3 space-y-2.5">
                                      <li v-for="group in groupSetsByExercise(w.sets)" :key="group.key">
                                          <p class="text-xs font-bold text-white">{{ exerciseName(group.exerciseId, group.name) }}</p>
                                          <p v-if="noteOf(w, group.exerciseId)" class="text-[11px] leading-snug text-slate-400" data-test="history-exnote">✎ {{ noteOf(w, group.exerciseId) }}</p>
                                          <div class="mt-1 flex flex-wrap gap-1">
                                              <template v-for="(set, n) in group.sets" :key="set.index">
                                                  <span class="hist-set" :class="{ 'is-warmup': set.isWarmup, 'is-pr': setBadges(w, set.index).length }" :title="setLabel(group.sets, n)">
                                                      <span v-if="setBadges(w, set.index).length" aria-hidden="true">{{ setBadges(w, set.index)[0]!.icon }}</span>
                                                      {{ describeSet(set, group.trackingType) }}<span v-if="set.rpe" class="ml-1 text-tiny text-orange-300">{{ rpeText(set.rpe, settings.useRir) }}</span>
                                                  </span>
                                              </template>
                                          </div>
                                          <template v-for="set in group.sets" :key="`n${set.index}`">
                                              <p v-if="set.note" class="mt-1 text-[11px] italic text-slate-400" data-test="set-note">{{ set.note }}</p>
                                          </template>
                                      </li>
                                  </ul>

                                  <!-- Uhr-Werte -->
                                  <dl v-if="w.health && (w.health.distanceM || w.health.avgHr || w.health.maxSpeedKmh)" class="mt-3 grid grid-cols-4 gap-1.5 text-center" data-test="history-health">
                                      <div v-if="w.health.distanceM" class="report-stat"><dt>km</dt><dd class="!text-sm">{{ kmh(w.health.distanceM / 1000) }}</dd></div>
                                      <div v-if="w.health.avgHr" class="report-stat"><dt>♥ Ø/max</dt><dd class="!text-sm">{{ w.health.avgHr }}<template v-if="w.health.maxHr">/{{ w.health.maxHr }}</template></dd></div>
                                      <div v-if="w.health.maxSpeedKmh" class="report-stat"><dt>{{ t('units.kmh') }}</dt><dd class="!text-sm">{{ kmh(w.health.maxSpeedKmh) }}</dd></div>
                                      <div v-if="w.health.sprints != null" class="report-stat"><dt>{{ t('history.sprints') }}</dt><dd class="!text-sm">{{ w.health.sprints }}</dd></div>
                                  </dl>

                                  <ul v-if="skippedOf(w).length" class="mt-3 space-y-1" data-test="history-skipped">
                                      <li v-for="n in skippedOf(w)" :key="n.exerciseId" class="rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-2 text-[11px] leading-snug">
                                          <span class="font-bold text-orange-300">{{ exerciseName(n.exerciseId) }}</span>
                                          <span class="text-slate-300"> · {{ t('workout.skippedLine', { reason: n.reason ? t(`exnote.reasons.${n.reason}`) : t('exnote.skipped') }) }}</span>
                                          <template v-if="n.note"><span class="text-slate-400"> · {{ n.note }}</span></template>
                                      </li>
                                  </ul>
                                  <p v-if="w.notes" class="mt-3 whitespace-pre-line rounded-xl bg-white/[0.04] px-3 py-2 text-xs italic text-slate-300">{{ w.notes }}</p>
                                  <p v-if="w.pending && w.error" class="mt-2 font-mono text-tiny text-red-400">{{ w.error }}</p>

                                  <!-- Aktionen -->
                                  <div class="hist-actions">
                                      <button v-if="w.pending && w.status === 'failed'" type="button" class="hist-action" @click="retryEntry(w)">{{ t('common.retry') }}</button>
                                      <button type="button" class="hist-action" @click="editWorkout(w)">{{ t('common.edit') }}</button>
                                      <button type="button" class="hist-action" @click="repeatWorkout(w)">{{ t('history.performAgain') }}</button>
                                      <button type="button" class="hist-action" data-test="obsidian-open" :aria-label="t('obsidian.open')" @click="openObsidian(w)">Obsidian</button>
                                      <button type="button" class="hist-action is-danger" :aria-label="t('history.deleteWorkout')" @click="deleteWorkout(w)">{{ t('common.delete') }}</button>
                                  </div>
                              </div>
                          </div>
                      </transition>
                  </article>
              </li>
          </ol>
      </section>

      <button v-if="matching.length > historyLimit" @click="historyLimit += 20" class="cyber-outline-btn w-full rounded-xl py-3 text-tiny font-bold caps tracking-widest" data-test="history-more">
          {{ t('history.showMore', { n: matching.length - historyLimit }) }}
      </button>
      <p v-if="!matching.length" class="glass-panel rounded-2xl p-8 text-center text-xs text-slate-400">{{ query ? t('history.noneForSearch') : t('history.noneForFilter') }}</p>
  </div>
</template>
