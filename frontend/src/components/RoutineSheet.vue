<script setup lang="ts">
// Routine anlegen/bearbeiten: Name, Art, Wochentage, Zeitraum (Dauer-Chips oder Datum), Grund, Schritte mit Dosis.
// Schritte lassen sich mit einer Katalog-Übung verknüpfen - dann gibt es Animation und Technik-Infos per Tipp.
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { exerciseName, muscleName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { cleanDraft, useRoutinesStore } from '@/stores/routines';
import { EVERY_DAY, MAX_ROUTINE_STEPS, ROUTINE_KINDS, addDays, daysBetween } from '@/lib/routines';
import { WEEKDAYS, bit } from '@/lib/schedule';
import { vSheetDrag } from '@/lib/gestures';

const app = useAppStore();
const routines = useRoutinesStore();
const { editor } = storeToRefs(routines);
const { exercises } = storeToRefs(app);
const d = computed(() => editor.value.draft);

const WEEKS = [1, 2, 3, 4, 6] as const;
const dayShort = (i: number) => new Date(2024, 0, 1 + i).toLocaleDateString(intlLocale(), { weekday: 'short' }).replace('.', '');
const dayLong = (i: number) => new Date(2024, 0, 1 + i).toLocaleDateString(intlLocale(), { weekday: 'long' });

const titleInput = ref<HTMLInputElement | null>(null);
const tried = ref(false);

/** Bearbeitete Routine läuft noch (dann gibt es "Jetzt beenden"). */
const running = computed(() => { const r = editor.value.clientId ? routines.byId(editor.value.clientId) : null; return !!r && routines.progressOf(r).state !== 'ended'; });
const valid = computed(() => { const c = cleanDraft(d.value); return !!c.title && c.steps.length > 0; });

// ---------- Tage ----------
const daily = computed(() => d.value.days === EVERY_DAY);
function toggleDay(i: number) {
  const next = d.value.days ^ bit(i);
  d.value.days = next === 0 ? d.value.days : next; // mindestens ein Tag
}
const setDaily = () => { d.value.days = EVERY_DAY; };

// ---------- Zeitraum ----------
/** Gewählte Dauer in Wochen, wenn das Ende genau passt (sonst eigenes Datum). */
const weeks = computed(() => (d.value.endDate ? WEEKS.find((w) => addDays(d.value.startDate, w * 7 - 1) === d.value.endDate) ?? null : null));
const setWeeks = (w: number | null) => { d.value.endDate = w == null ? null : addDays(d.value.startDate, w * 7 - 1); };
watch(() => d.value.startDate, (start, old) => {
  // Beginn verschoben: Dauer bleibt gleich
  if (!start || !old || !d.value.endDate) return;
  d.value.endDate = addDays(d.value.endDate, daysBetween(old, start));
});
const endInput = computed({ get: () => d.value.endDate ?? '', set: (v: string) => { d.value.endDate = v || null; } });

// ---------- Schritte ----------
const stepInputs = ref<HTMLInputElement[]>([]);
function addStep() {
  if (d.value.steps.length >= MAX_ROUTINE_STEPS) return;
  d.value.steps.push({ name: '', dose: '' });
  void nextTick(() => stepInputs.value[d.value.steps.length - 1]?.focus());
}
function removeStep(i: number) {
  d.value.steps.splice(i, 1);
  if (!d.value.steps.length) d.value.steps.push({ name: '', dose: '' });
  linking.value = null;
}
function moveUp(i: number) {
  if (i <= 0) return;
  const s = d.value.steps;
  [s[i - 1], s[i]] = [s[i], s[i - 1]];
}

/** Schritt, für den gerade eine Übung gesucht wird. */
const linking = ref<number | null>(null);
const query = ref('');
function startLink(i: number) {
  linking.value = linking.value === i ? null : i;
  query.value = d.value.steps[i]?.name ?? '';
}
const matches = computed(() => (linking.value == null ? [] : app.searchExercises(query.value, exercises.value).slice(0, 6)));
function link(i: number, id: number) {
  const ex = app.exerciseFor(id);
  const step = d.value.steps[i];
  if (!step || !ex) return;
  step.exerciseId = id;
  if (!step.name.trim()) step.name = exerciseName(ex);
  linking.value = null;
}
const unlink = (i: number) => { const s = d.value.steps[i]; if (s) s.exerciseId = null; };
const linkedName = (id: number | null | undefined) => (id != null ? exerciseName(app.exerciseFor(id) ?? id) : '');

// Am Ende: braucht linking/tried (sonst Zugriff vor der Deklaration beim sofortigen Lauf)
watch(() => editor.value.open, (open) => {
  if (!open) return;
  tried.value = false;
  linking.value = null;
  // Neue Routine: gleich ins Namensfeld (Bearbeiten: nicht, sonst springt die Tastatur auf)
  if (!editor.value.clientId) void nextTick(() => titleInput.value?.focus({ preventScroll: true }));
}, { immediate: true });

function save() {
  tried.value = true;
  if (!routines.save()) return;
}
</script>

<template>
  <transition name="sheet">
      <div v-if="editor.open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="routines.close()" @keydown.esc.stop="routines.close()">
          <form v-sheet-drag:handle="() => routines.close()" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
                role="dialog" aria-modal="true" aria-labelledby="routine-sheet-title" data-test="routine-sheet" @submit.prevent="save">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('routines.title') }}</p>
                      <h2 id="routine-sheet-title" class="display mt-1 truncate text-2xl text-white">{{ editor.clientId ? t('routines.sheet.editTitle') : t('routines.sheet.newTitle') }}</h2>
                  </div>
                  <button type="button" @click="routines.close()" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 overflow-y-auto px-6 pb-4">
                  <label class="label-xs mb-2" for="routine-title">{{ t('routines.sheet.name') }}</label>
                  <input id="routine-title" ref="titleInput" v-model="d.title" type="text" maxlength="60" class="field h-12 w-full rounded-xl px-4" :placeholder="t('routines.sheet.namePlaceholder')" data-test="routine-title">

                  <p class="label-xs mb-2 mt-5" id="routine-kind">{{ t('routines.sheet.kind') }}</p>
                  <div class="flex flex-wrap gap-2" role="group" aria-labelledby="routine-kind">
                      <button v-for="k in ROUTINE_KINDS" :key="k" type="button" class="chip min-h-[2.25rem]" :class="d.kind === k ? 'chip-active' : 'chip-idle'"
                              :aria-pressed="d.kind === k" :data-kind="k" @click="d.kind = k">{{ t(`routines.kinds.${k}`) }}</button>
                  </div>

                  <p class="label-xs mb-2 mt-5" id="routine-days">{{ t('routines.sheet.days') }}</p>
                  <div class="grid grid-cols-7 gap-1" role="group" aria-labelledby="routine-days">
                      <button v-for="i in WEEKDAYS" :key="i" type="button" class="routine-day" :class="{ 'is-on': (d.days & bit(i)) !== 0 }"
                              :aria-pressed="(d.days & bit(i)) !== 0" :aria-label="dayLong(i)" :data-day="i" @click="toggleDay(i)">{{ dayShort(i) }}</button>
                  </div>
                  <button type="button" class="mt-2 text-xs font-bold" :class="daily ? 'text-accent' : 'text-slate-400 hover:text-white'" :aria-pressed="daily" @click="setDaily">{{ t('routines.sheet.daily') }}</button>

                  <div class="mt-5 grid grid-cols-2 gap-3">
                      <div>
                          <label class="label-xs mb-2" for="routine-start">{{ t('routines.sheet.start') }}</label>
                          <input id="routine-start" v-model="d.startDate" type="date" required class="field h-12 w-full rounded-xl px-3" data-test="routine-start">
                      </div>
                      <div>
                          <label class="label-xs mb-2" for="routine-end">{{ t('routines.sheet.end') }}</label>
                          <input id="routine-end" v-model="endInput" type="date" :min="d.startDate" class="field h-12 w-full rounded-xl px-3" data-test="routine-end">
                      </div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5" role="group" :aria-label="t('routines.sheet.duration')">
                      <button v-for="w in WEEKS" :key="w" type="button" class="preset-btn !min-h-[2.25rem] !px-3 !py-1.5 text-xs" :class="{ '!border-accent/60 !text-accent': weeks === w }"
                              :aria-pressed="weeks === w" :data-weeks="w" @click="setWeeks(w)">{{ tn('routines.sheet.durationWeeks', w) }}</button>
                      <button type="button" class="preset-btn !min-h-[2.25rem] !px-3 !py-1.5 text-xs" :class="{ '!border-accent/60 !text-accent': !d.endDate }" :aria-pressed="!d.endDate" @click="setWeeks(null)">∞</button>
                  </div>
                  <p class="mt-1.5 text-[11px] text-slate-500">{{ t('routines.sheet.endHint') }}</p>

                  <label class="label-xs mb-2 mt-5" for="routine-reason">{{ t('routines.sheet.reason') }} <span class="normal-case tracking-normal text-slate-500">({{ t('common.optional') }})</span></label>
                  <textarea id="routine-reason" v-model="d.reason" rows="2" maxlength="300" class="field w-full resize-none rounded-xl px-4 py-3 text-sm" :placeholder="t('routines.sheet.reasonPlaceholder')"></textarea>

                  <p class="label-xs mb-2 mt-5">{{ t('routines.sheet.steps') }}</p>
                  <ol class="space-y-2" data-test="routine-steps">
                      <li v-for="(s, i) in d.steps" :key="i" class="rounded-2xl border border-white/10 bg-white/[0.03] p-3" :data-step="i">
                          <div class="flex items-center gap-2">
                              <span class="routine-step-no" aria-hidden="true">{{ i + 1 }}</span>
                              <input :ref="(el) => { if (el) stepInputs[i] = el as HTMLInputElement }" v-model="s.name" type="text" maxlength="80" class="field h-11 min-w-0 flex-1 rounded-xl px-3 text-sm"
                                     :placeholder="t('routines.sheet.stepName')" :aria-label="`${t('routines.sheet.stepName')} ${i + 1}`" data-test="routine-step-name">
                              <button type="button" class="routine-icon-btn" :class="{ 'text-accent': s.exerciseId != null || linking === i }" :aria-label="t('routines.sheet.linkExercise')" :aria-expanded="linking === i" @click="startLink(i)" data-test="routine-step-link">
                                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1"/></svg>
                              </button>
                          </div>
                          <div class="mt-2 flex items-center gap-2 pl-8">
                              <input v-model="s.dose" type="text" maxlength="60" class="field h-10 min-w-0 flex-1 rounded-xl px-3 font-mono text-xs" :placeholder="t('routines.sheet.stepDosePlaceholder')" :aria-label="`${t('routines.sheet.stepDose')} ${i + 1}`" data-test="routine-step-dose">
                              <button v-if="i > 0" type="button" class="routine-icon-btn" :aria-label="t('routines.sheet.moveUp', { n: i + 1 })" @click="moveUp(i)">
                                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 15l6-6 6 6"/></svg>
                              </button>
                              <button type="button" class="routine-icon-btn hover:!text-red-300" :aria-label="t('routines.sheet.removeStep', { n: i + 1 })" @click="removeStep(i)">✕</button>
                          </div>
                          <p v-if="s.exerciseId != null" class="mt-2 flex items-center gap-2 pl-8 text-[11px] text-slate-400">
                              <span class="min-w-0 truncate">{{ t('routines.sheet.linked', { name: linkedName(s.exerciseId) }) }}</span>
                              <button type="button" class="flex-shrink-0 font-bold text-slate-400 underline hover:text-white" @click="unlink(i)">{{ t('routines.sheet.unlink') }}</button>
                          </p>
                          <div v-if="linking === i" class="mt-2 pl-8">
                              <input v-model="query" type="search" class="field h-10 w-full rounded-xl px-3 text-sm" :placeholder="t('picker.search')" :aria-label="t('picker.search')" data-test="routine-link-search">
                              <ul class="mt-1 max-h-48 overflow-y-auto">
                                  <li v-for="e in matches" :key="e.id">
                                      <button type="button" class="flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-lg px-2 text-left hover:bg-white/5" :data-link-pick="e.id" @click="link(i, e.id)">
                                          <span class="min-w-0 truncate text-sm font-bold text-white">{{ exerciseName(e) }}</span>
                                          <span class="flex-shrink-0 font-mono text-[10px] text-slate-500">{{ muscleName(e.muscleGroup) }}</span>
                                      </button>
                                  </li>
                              </ul>
                          </div>
                      </li>
                  </ol>
                  <button v-if="d.steps.length < MAX_ROUTINE_STEPS" type="button" class="btn-ghost mt-2 w-full rounded-xl py-3 text-xs" data-test="routine-add-step" @click="addStep">+ {{ t('routines.sheet.addStep') }}</button>
                  <p v-if="tried && !valid" class="mt-3 text-xs font-bold text-red-300" role="alert">{{ t('routines.sheet.invalid') }}</p>
              </div>

              <div class="flex gap-2 border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <template v-if="editor.clientId">
                      <button type="button" class="btn-ghost rounded-xl px-3 py-4 text-sm text-red-400" @click="routines.remove(editor.clientId)" data-test="routine-delete">{{ t('common.delete') }}</button>
                      <button v-if="running" type="button" class="btn-ghost rounded-xl px-3 py-4 text-sm" @click="routines.finish(editor.clientId)" data-test="routine-finish">{{ t('routines.sheet.finish') }}</button>
                  </template>
                  <button type="submit" class="btn-primary flex-1 rounded-xl py-4 text-sm" :aria-disabled="!valid" data-test="routine-save">{{ t('common.save') }}</button>
              </div>
          </form>
      </div>
  </transition>
</template>
