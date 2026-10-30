<script setup lang="ts">
// Einheit (oder ganzen Tag) als Dataview-Zeilen für die Daily Note kopieren.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, locale, textIn, SUPPORTED_LOCALES, type Locale } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';
import { dateKey, trackingOf } from '@/lib/analytics';
import { describeSet, formatDate } from '@/lib/format';
import { inferSessionCode, obsidianText, SESSION_CODES, type SessionCode } from '@/lib/obsidian';
import { readJson, writeJson } from '@/lib/storage';
import type { Workout, WorkoutSet } from '@/types';

const app = useAppStore();
const { allWorkouts, exercisesById, obsidianWorkout } = storeToRefs(app);
const { toast } = useUiStore();

const PREFS_KEY = 'sprintlog:obsidian';
interface Prefs { lang: Locale | null; includeWarmups: boolean; fieldAsText: boolean; wholeDay: boolean }
const prefs = ref<Prefs>({ lang: null, includeWarmups: false, fieldAsText: true, wholeDay: true, ...readJson<Partial<Prefs>>(PREFS_KEY, {}) });
watch(prefs, (v) => writeJson(PREFS_KEY, v), { deep: true });

/** Sprache der Übungsnamen: Standard = App-Sprache (Ziele in LIFT_GOALS stehen meist auf Russisch). */
const lang = computed<Locale>(() => prefs.value.lang ?? locale.value);
/** Manuell geänderte Session-Codes pro Einheit. */
const sesOverride = ref<Record<string, SessionCode>>({});
const copied = ref(false);

const keyOf = (w: Workout) => String(w.id ?? w.clientId ?? w.date);
const sameDay = computed(() => {
  const w = obsidianWorkout.value;
  if (!w) return [];
  const day = dateKey(w.date);
  return allWorkouts.value.filter((x) => dateKey(x.date) === day);
});
const workouts = computed(() => (prefs.value.wholeDay ? sameDay.value : obsidianWorkout.value ? [obsidianWorkout.value] : []));

const catalog = (s: WorkoutSet) => (s.exerciseId != null ? exercisesById.value.get(s.exerciseId) : undefined);
const options = computed(() => ({
  includeWarmups: prefs.value.includeWarmups,
  fieldAsText: prefs.value.fieldAsText,
  nameOf: (s: WorkoutSet) => {
    const id = s.exerciseId;
    const custom = id == null || id >= 1000 || catalog(s)?.isCustom;
    return (custom ? undefined : textIn(lang.value, `exercises.${id}`)) ?? s.exerciseName ?? s.name ?? '?';
  },
  muscleOf: (s: WorkoutSet) => catalog(s)?.muscleGroup ?? s.muscleGroup,
  categoryOf: (s: WorkoutSet) => catalog(s)?.category ?? s.category,
  describe: (s: WorkoutSet) => describeSet(s, trackingOf(s)),
  warmupLabel: t('set.warmup'),
}));

const sesOf = (w: Workout): SessionCode => sesOverride.value[keyOf(w)] ?? inferSessionCode(w, options.value);
const text = computed(() => obsidianText(workouts.value, { ...options.value, sesFor: sesOf }));
const missingMinutes = computed(() => workouts.value.some((w) => !w.durationSeconds));

watch(obsidianWorkout, () => { sesOverride.value = {}; copied.value = false; });

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value);
    copied.value = true;
    toast(t('obsidian.copied'), 'success');
  } catch {
    // Zwischenablage blockiert (z. B. In-App-Browser): Text markieren, Nutzer kopiert selbst.
    const el = document.getElementById('obsidian-text') as HTMLTextAreaElement | null;
    el?.focus();
    el?.select();
    toast(t('obsidian.selectManually'), 'info');
  }
}

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
async function share() {
  try { await navigator.share({ text: text.value }); } catch { /* abgebrochen */ }
}
</script>

<template>
  <transition name="fade">
      <div v-if="obsidianWorkout" class="backdrop fixed inset-0 z-40 flex items-end justify-center sm:items-center" @click.self="obsidianWorkout = null">
          <div class="modal-panel glass-panel max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl sm:p-6" role="dialog" aria-modal="true" :aria-label="t('obsidian.title')">
              <div class="mb-4 flex items-start justify-between gap-3">
                  <div>
                      <h3 class="display text-2xl text-white">{{ t('obsidian.title') }}</h3>
                      <p class="mt-1 font-mono text-[11px] text-slate-400">{{ formatDate(obsidianWorkout.date, { weekday: 'short', day: '2-digit', month: 'short' }) }} · {{ t('obsidian.subtitle') }}</p>
                  </div>
                  <button type="button" @click="obsidianWorkout = null" class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <!-- Session-Code pro Einheit -->
              <div v-for="w in workouts" :key="keyOf(w)" class="mb-3">
                  <p class="label-xs mb-1.5">{{ t('obsidian.sessionType') }}<template v-if="workouts.length > 1"> · {{ formatDate(w.date, { hour: '2-digit', minute: '2-digit' }) }}</template></p>
                  <div class="flex flex-wrap gap-1.5">
                      <button v-for="code in SESSION_CODES" :key="code" type="button" @click="sesOverride = { ...sesOverride, [keyOf(w)]: code }" :data-ses="code"
                              class="rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold transition-colors"
                              :class="sesOf(w) === code ? 'border-accent bg-accent text-on-accent' : 'border-white/10 text-slate-400 hover:text-white'">{{ code }}</button>
                  </div>
              </div>

              <div class="mb-3 flex flex-wrap items-center gap-2">
                  <span class="label-xs">{{ t('obsidian.names') }}</span>
                  <button v-for="code in SUPPORTED_LOCALES" :key="code" type="button" @click="prefs.lang = code" :aria-pressed="lang === code"
                          class="rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold uppercase" :class="lang === code ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'">{{ code }}</button>
              </div>
              <div class="mb-4 space-y-2">
                  <label v-if="sameDay.length > 1" class="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-slate-200">
                      {{ t('obsidian.wholeDay', { n: sameDay.length }) }} <input v-model="prefs.wholeDay" type="checkbox" class="h-5 w-5">
                  </label>
                  <label class="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-slate-200">
                      {{ t('obsidian.fieldAsText') }} <input v-model="prefs.fieldAsText" type="checkbox" class="h-5 w-5">
                  </label>
                  <label class="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-slate-200">
                      {{ t('obsidian.includeWarmups') }} <input v-model="prefs.includeWarmups" type="checkbox" class="h-5 w-5">
                  </label>
              </div>

              <textarea id="obsidian-text" :value="text" readonly rows="8" data-test="obsidian-text"
                        class="field code-text mb-2 w-full resize-none rounded-xl p-3 text-xs leading-relaxed" :aria-label="t('obsidian.preview')"></textarea>
              <p v-if="missingMinutes" class="mb-3 rounded-xl border border-orange-400/30 bg-orange-400/10 p-3 text-xs text-orange-300">{{ t('obsidian.noMinutes') }}</p>
              <p class="mb-4 text-xs leading-relaxed text-slate-500">{{ t('obsidian.hint') }}</p>

              <div class="grid gap-2" :class="canShare ? 'grid-cols-2' : 'grid-cols-1'">
                  <button type="button" @click="copy" data-test="obsidian-copy" class="btn-primary h-12 rounded-xl text-sm">{{ copied ? t('obsidian.copiedShort') : t('obsidian.copy') }}</button>
                  <button v-if="canShare" type="button" @click="share" class="btn-secondary h-12 rounded-xl text-sm font-bold">{{ t('obsidian.share') }}</button>
              </div>
          </div>
      </div>
  </transition>
</template>
