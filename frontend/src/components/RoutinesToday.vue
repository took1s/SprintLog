<script setup lang="ts">
// Heute fällige Routinen als Checkliste auf dem Start-Bildschirm: abhaken mit einem Tipp (bei mehrmals täglich zählt
// jeder Tipp einen Durchgang), aufklappen für Durchgänge mit Uhrzeit, Schritte, Nachtragen und Verlauf.
// Reha: nach dem ersten Haken des Tages kurz nach dem Schmerz (0-10) fragen. Alles erledigt: kleine Feier.
// Ohne fällige Routine erscheint nichts.
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useRoutinesStore } from '@/stores/routines';
import { useRemindersStore } from '@/stores/reminders';
import { clockTime, nextRound, painOn, painTone, parseDay, roundGate, roundTime, slotOf, tracksPain, type Routine } from '@/lib/routines';
import { alarmHaptic, tap as haptic } from '@/lib/native';
import RoutineMeta from './RoutineMeta.vue';
import RoutineStepRow from './RoutineStepRow.vue';
import PainScale from './PainScale.vue';

const app = useAppStore();
const routines = useRoutinesStore();
const reminders = useRemindersStore();
const { forToday, painAsk, today } = storeToRefs(routines);

const doneCount = computed(() => forToday.value.filter((r) => routines.progressOf(r).doneToday).length);
const allDone = computed(() => forToday.value.length > 0 && doneCount.value === forToday.value.length);
const open = ref<string | null>(null);
const toggleOpen = (id: string) => { open.value = open.value === id ? null : id; };
/** Gerade abgehakt: kurze Bestätigungs-Animation. */
const justDone = ref<string | null>(null);
/** Gerade alles erledigt: Funken im Kopf der Karte. */
const celebrate = ref(false);
/** Schmerz von heute ändern (Abzeichen angetippt). */
const editPain = ref<string | null>(null);

const p = (r: Routine) => routines.progressOf(r);
const date = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
const now = computed(() => clockTime(app.clockDate));

/**
 * Großer Haken: nächster Durchgang. Einmal täglich: normaler Haken (nochmal tippen löst ihn).
 * Mehrmals täglich und schon alles erledigt: nicht still einen Durchgang lösen, sondern die Durchgänge aufklappen.
 */
/** Durchgang noch nicht dran (Abend um 14 Uhr): erst nachfragen statt still abhaken/starten. */
const early = ref<{ id: string; action: 'tick' | 'play' } | null>(null);
const gate = (r: Routine) => roundGate(r, today.value, now.value);

function main(r: Routine, force = false) {
  const before = p(r);
  if (r.timesPerDay > 1 && before.doneToday) { open.value = r.clientId; haptic(); return; }
  if (!force && gate(r)?.open === false) { early.value = { id: r.clientId, action: 'tick' }; haptic(); return; }
  early.value = null;
  routines.tap(r.clientId, Math.min(before.countToday + 1, r.timesPerDay));
  haptic();
  // Der Store ersetzt das Objekt beim Abhaken -> aktuellen Stand neu holen (sonst bleibt die Animation aus)
  const fresh = routines.byId(r.clientId);
  const nowDone = !!fresh && p(fresh).doneToday;
  justDone.value = nowDone && !before.doneToday ? r.clientId : null;
  if (justDone.value) window.setTimeout(() => { if (justDone.value === r.clientId) justDone.value = null; }, 700);
}

/** Player für den Durchgang, der jetzt dran ist (bzw. Fortsetzen). */
function play(r: Routine, force = false) {
  if (!force && !routines.progressFor(r.clientId) && !p(r).doneToday && gate(r)?.open === false) { early.value = { id: r.clientId, action: 'play' }; haptic(); return; }
  early.value = null;
  routines.openPlayer(r.clientId);
}

function confirmEarly(r: Routine) {
  const action = early.value?.action;
  early.value = null;
  if (action === 'play') play(r, true);
  else main(r, true);
}

/** Name eines Durchgangs: Tageszeit (mit Uhrzeit) oder Nummer. */
const roundName = (r: Routine, k: number) => { const time = roundTime(r, k); return time ? t(`routines.slots.${slotOf(time)}`) : t('routines.round', { n: k }); };

/** Beschriftung des Start-Knopfs: Fortsetzen / Tageszeit des fälligen Durchgangs / nochmal. */
function playLabel(r: Routine): string {
  if (routines.progressFor(r.clientId)) return t('routines.player.continue');
  if (r.timesPerDay > 1 && !p(r).doneToday) return roundName(r, p(r).countToday + 1);
  return t('routines.player.start');
}

watch(allDone, (done, was) => {
  if (!done || was) return;
  celebrate.value = true;
  alarmHaptic();
  window.setTimeout(() => { celebrate.value = false; }, 1400);
});

/** Ring um den Haken: Anteil der heutigen Durchgänge (Kreisumfang 2π·19). */
const RING = 2 * Math.PI * 19;
const ringOffset = (r: Routine) => RING * (1 - Math.min(1, p(r).countToday / r.timesPerDay));
/** Ring im Kopf: erledigte Routinen heute (Kreisumfang 2π·15). */
const HEAD = 2 * Math.PI * 15;
const headOffset = computed(() => HEAD * (1 - (forToday.value.length ? doneCount.value / forToday.value.length : 0)));

function mainLabel(r: Routine) {
  if (r.timesPerDay === 1) return p(r).doneToday ? t('routines.markOpen', { title: r.title }) : t('routines.markDone', { title: r.title });
  if (p(r).doneToday) return t('routines.allRoundsDone', { title: r.title, total: r.timesPerDay });
  return t('routines.tickLabel', { title: r.title, done: p(r).countToday, total: r.timesPerDay });
}

/**
 * Was heute noch offen ist: "Ещё 2 раза · Вечер 20:00" (mehrmals täglich) bzw. "Вечер 18:00" (einmal mit Uhrzeit);
 * ist die Uhrzeit erreicht: "Jetzt" hervorgehoben.
 */
function nextLabel(r: Routine): { text: string; due: boolean } | null {
  const n = nextRound(r, today.value, now.value);
  if (!n) return null;
  const left = r.timesPerDay - (n.k - 1);
  const parts: string[] = [];
  if (r.timesPerDay > 1) parts.push(tn('routines.remaining', left));
  if (n.time) {
    const slot = t(`routines.slots.${slotOf(n.time)}`);
    parts.push(n.due ? t('routines.dueNow', { slot }) : `${slot} ${n.time}`);
  }
  return parts.length ? { text: parts.join(' · '), due: !!n.time && n.due } : null;
}

function pipLabel(r: Routine, k: number) {
  const time = roundTime(r, k);
  return time ? t('routines.roundAt', { n: k, time }) : t('routines.round', { n: k });
}

const painToday = (r: Routine) => (tracksPain(r) ? painOn(r, today.value) : null);
const asking = (r: Routine) => painAsk.value?.clientId === r.clientId || editPain.value === r.clientId;
function pickPain(r: Routine, level: number) {
  routines.setPain(r.clientId, level);
  editPain.value = null;
  haptic();
}
function skipPain(r: Routine) {
  if (editPain.value === r.clientId) editPain.value = null;
  else routines.skipPain();
}

// Erinnerung angetippt: Routine aufklappen und hinscrollen
const flash = ref<string | null>(null);
watch(() => reminders.focus, async (f) => {
  if (!f || f.kind !== 'routine' || !f.target || !forToday.value.some((r) => r.clientId === f.target)) return;
  open.value = f.target;
  flash.value = f.target;
  await nextTick();
  document.querySelector(`[data-routine="${f.target}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => { flash.value = null; }, 1600);
}, { immediate: true });
</script>

<template>
  <section v-if="forToday.length" class="routine-today mt-5 rounded-2xl border p-4" :class="allDone ? 'is-complete' : ''" data-test="routines-today" aria-labelledby="routines-today-title">
      <div class="flex items-center gap-3">
          <span class="routine-head-ring" :class="{ 'is-done': allDone, 'is-celebrate': celebrate }" aria-hidden="true">
              <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="routine-head-track" /><circle cx="18" cy="18" r="15" class="routine-head-fill" :style="{ strokeDasharray: HEAD, strokeDashoffset: headOffset }" /></svg>
              <svg v-if="allDone" class="routine-head-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              <span v-else class="routine-head-count">{{ doneCount }}</span>
              <span v-if="celebrate" class="finish-burst"><i v-for="n in 12" :key="n"></i></span>
          </span>
          <div class="min-w-0 flex-1">
              <h3 id="routines-today-title" class="routine-today-title" :class="{ 'is-done': allDone }">{{ t('routines.todayTitle') }}</h3>
              <p class="font-mono text-[11px] text-slate-400" aria-live="polite">{{ allDone ? t('routines.allDone') : t('routines.doneCount', { done: doneCount, total: forToday.length }) }}</p>
          </div>
      </div>
      <ul class="mt-3 space-y-1.5">
          <li v-for="r in forToday" :key="r.clientId" class="routine-item rounded-xl" :class="{ 'is-flash': flash === r.clientId }" :data-routine="r.clientId">
              <div class="flex items-center gap-2">
                  <button type="button" class="routine-check" :class="{ 'is-done': p(r).doneToday, 'is-pop': justDone === r.clientId, 'is-multi': r.timesPerDay > 1 }"
                          :aria-pressed="p(r).doneToday" :aria-label="mainLabel(r)" data-test="routine-check" @click="main(r)">
                      <svg v-if="r.timesPerDay > 1 && !p(r).doneToday" class="routine-ring" viewBox="0 0 44 44" aria-hidden="true">
                          <circle cx="22" cy="22" r="19" class="routine-ring-track" />
                          <circle cx="22" cy="22" r="19" class="routine-ring-fill" :style="{ strokeDasharray: RING, strokeDashoffset: ringOffset(r) }" />
                      </svg>
                      <span v-if="r.timesPerDay > 1 && !p(r).doneToday" class="routine-count" aria-hidden="true">{{ p(r).countToday }}/{{ r.timesPerDay }}</span>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path class="routine-check-path" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  </button>
                  <button type="button" class="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left" :aria-expanded="open === r.clientId" @click="toggleOpen(r.clientId)">
                      <span class="min-w-0 flex-1">
                          <span class="line-clamp-2 break-words text-sm font-bold leading-snug transition-colors" :class="p(r).doneToday ? 'text-slate-400 line-through decoration-1' : 'text-white'">{{ r.title }}</span>
                          <RoutineMeta :routine="r" compact />
                          <span v-if="r.timesPerDay === 1 && nextLabel(r) && !p(r).doneToday" class="routine-next" :class="{ 'is-due': nextLabel(r)!.due }" data-test="routine-next">{{ nextLabel(r)!.text }}</span>
                      </span>
                      <span v-if="p(r).missedRecent" class="routine-missed-dot" :title="t('routines.missedOn', { date: date(p(r).missedRecent!) })" aria-hidden="true"></span>
                      <svg class="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': open === r.clientId }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
                  </button>
                  <!-- Start mit Timer: immer sichtbar, beschriftet mit dem Durchgang, der jetzt dran ist -->
                  <button v-if="!p(r).doneToday || routines.progressFor(r.clientId)" type="button" class="routine-play-btn" :class="{ 'is-later': gate(r)?.open === false && !routines.progressFor(r.clientId) }"
                          :aria-label="`${t('routines.player.startLong')}: ${r.title} · ${playLabel(r)}`" data-test="routine-play" @click="play(r)">
                      <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/></svg>
                      <span class="truncate">{{ playLabel(r) }}</span>
                  </button>
              </div>

              <!-- Mehrmals täglich: Durchgänge des Tages auf einen Blick (erledigt / jetzt / später) -->
              <ol v-if="r.timesPerDay > 1" class="routine-rounds ml-12 mt-1" :aria-label="t('routines.rounds')" data-test="routine-rounds">
                  <li v-for="k in r.timesPerDay" :key="k" class="routine-round"
                      :class="k <= p(r).countToday ? 'is-done' : k === p(r).countToday + 1 ? (gate(r)?.open ? 'is-now' : 'is-next') : 'is-later'" :data-round="k">
                      <svg v-if="k <= p(r).countToday" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                      <span>{{ roundName(r, k) }}</span>
                      <span v-if="roundTime(r, k)" class="font-mono opacity-70">{{ roundTime(r, k) }}</span>
                  </li>
              </ol>

              <!-- Noch nicht dran: nachfragen -->
              <transition name="expand">
                  <div v-if="early?.id === r.clientId" class="expand-wrap" data-test="routine-early">
                      <div class="routine-pain-ask ml-12 mt-1.5">
                          <p class="text-xs leading-snug text-slate-200">{{ t('routines.early', { slot: roundName(r, gate(r)!.k), time: gate(r)!.time ?? '', from: gate(r)!.opensAt ?? '' }) }}</p>
                          <div class="mt-2 flex gap-2">
                              <button type="button" class="btn-secondary flex-1 rounded-xl px-3 py-2 text-xs" @click="early = null">{{ t('routines.later') }}</button>
                              <button type="button" class="btn-primary flex-1 rounded-xl px-3 py-2 text-xs" data-test="routine-early-yes" @click="confirmEarly(r)">{{ early.action === 'play' ? t('routines.startNow') : t('routines.markNow') }}</button>
                          </div>
                      </div>
                  </div>
              </transition>

              <!-- Reha: Schmerz nach dem ersten Haken des Tages (oder Abzeichen angetippt) -->
              <transition name="expand">
                  <div v-if="asking(r)" class="expand-wrap" data-test="pain-ask">
                      <div class="routine-pain-ask ml-12 mt-1.5">
                          <p class="text-xs font-bold text-white">{{ t('routines.pain.question') }}</p>
                          <PainScale class="mt-2" :model-value="painToday(r)" @pick="(n) => pickPain(r, n)" />
                          <div class="mt-1 flex items-center justify-between gap-2">
                              <p class="text-tiny text-slate-500">{{ t('routines.pain.scale') }}</p>
                              <button type="button" class="-mr-2 min-h-[2.25rem] flex-shrink-0 px-2 text-[11px] font-bold text-slate-400 hover:text-white" data-test="pain-skip" @click="skipPain(r)">{{ t('routines.pain.skip') }}</button>
                          </div>
                      </div>
                  </div>
              </transition>
              <button v-if="painToday(r) != null && !asking(r)" type="button" class="pain-badge ml-12 mt-1" :class="`is-${painTone(painToday(r)!)}`"
                      :aria-label="t('routines.pain.change', { n: painToday(r)! })" data-test="pain-badge" @click="editPain = r.clientId">{{ t('routines.pain.badge', { n: painToday(r)! }) }}</button>

              <transition name="expand">
                  <div v-if="open === r.clientId" class="expand-wrap">
                      <div class="mb-1 ml-12 mt-1" data-test="routine-today-steps">
                          <!-- Mehrmals täglich: jeder Durchgang einzeln, mit Uhrzeit falls gesetzt -->
                          <div v-if="r.timesPerDay > 1" class="mb-2 flex flex-wrap items-center gap-1.5" role="group" :aria-label="t('routines.rounds')">
                              <button v-for="k in r.timesPerDay" :key="k" type="button" class="routine-pip" :class="{ 'is-on': k <= p(r).countToday, 'has-time': !!roundTime(r, k) }"
                                      :aria-pressed="k <= p(r).countToday" :aria-label="pipLabel(r, k)" :data-pip="k" @click="routines.tap(r.clientId, k)">
                                  <template v-if="roundTime(r, k)"><span class="routine-pip-slot">{{ t(`routines.slots.${slotOf(roundTime(r, k)!)}`) }}</span>{{ roundTime(r, k) }}</template>
                                  <template v-else>{{ k }}</template>
                              </button>
                          </div>
                          <ol class="space-y-1.5">
                              <RoutineStepRow v-for="(s, i) in r.steps" :key="i" :name="s.name" :dose="s.dose" :exercise-id="s.exerciseId" @info="(id) => app.openExerciseInfo(id, 'overlay')" />
                          </ol>
                          <p v-if="r.reason" class="pt-1 text-[11px] leading-snug text-slate-400">{{ r.reason }}</p>
                          <div class="mt-2 flex flex-wrap items-center gap-2">
                              <button v-if="p(r).doneToday" type="button" class="routine-link" data-test="routine-play-extra" @click="routines.openPlayer(r.clientId)">▶ {{ t('routines.player.again') }}</button>
                              <button v-if="p(r).missedRecent" type="button" class="routine-link" data-test="routine-catch-up" @click="routines.setDone(r.clientId, true, p(r).missedRecent!)">
                                  {{ t('routines.catchUp', { date: date(p(r).missedRecent!) }) }}
                              </button>
                              <button type="button" class="routine-link" data-test="routine-history" @click="routines.openDetail(r.clientId)">{{ t('routines.history') }}</button>
                          </div>
                      </div>
                  </div>
              </transition>
          </li>
      </ul>
  </section>
</template>
