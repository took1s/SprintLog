<script setup lang="ts">
// Jeden Tag in 10 Sekunden: Gewicht (morgens) und Eiweiß. Tag wählbar - vergessene Tage nachtragen.
// Gewicht mit ±0,1-Schritten vom letzten Wert aus, darunter 7-Tage-Mittel und Wochenrate mit Einordnung.
// Eiweiß: Ring gegen das Ziel (1,6-2,2 g/kg), typische Portionen als Schnellwahl, eigene Gramm, Rückgängig.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { useAthleteStore, proteinTarget } from '@/stores/athlete';
import { addDays, parseDay } from '@/lib/routines';
import { FOODS, avgAt, proteinLeft, rateTone, weeklyRate } from '@/lib/nutrition';
import DecimalInput from '@/components/DecimalInput.vue';
import { tap as haptic } from '@/lib/native';

const athlete = useAthleteStore();
const { daily, today, latestWeight } = storeToRefs(athlete);

/** Gewählter Tag (heute oder bis 6 Tage zurück). */
const day = ref(today.value);
watch(today, (n, o) => { if (day.value === o) day.value = n; });
const days = computed(() => Array.from({ length: 7 }, (_, i) => {
  const d = addDays(today.value, -i);
  const log = daily.value.find((x) => x.day === d);
  return { day: d, i, weight: log?.weightKg != null, protein: (log?.proteinG ?? 0) > 0 };
}));
const label = (d: string, i: number) => (i === 0 ? t('wellness.today') : i === 1 ? t('wellness.yesterday') : parseDay(d).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric' }));
const log = computed(() => daily.value.find((d) => d.day === day.value) ?? null);
const fmtKg = (v: number) => v.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ---------- Gewicht ----------

const editing = ref(false);
const draft = ref<number | null>(null);
/** Ausgangswert für die ±-Schritte: Wert des Tages, sonst letzter bekannter. */
const base = computed(() => log.value?.weightKg ?? latestWeight.value ?? null);
watch([day, () => log.value?.weightKg], () => { editing.value = false; draft.value = null; });
function startEdit() { editing.value = true; draft.value = base.value; }
function step(d: number) {
  const v = (draft.value ?? base.value ?? 70) + d;
  draft.value = Math.round(Math.min(250, Math.max(30, v)) * 10) / 10;
  haptic();
}
const weightValid = computed(() => draft.value != null && draft.value >= 30 && draft.value <= 250);
function saveWeight() {
  if (!weightValid.value) return;
  athlete.setDaily(day.value, { weightKg: Math.round(draft.value! * 10) / 10 });
  editing.value = false;
  draft.value = null;
  haptic();
}
const showForm = computed(() => editing.value || log.value?.weightKg == null);

const avg7 = computed(() => avgAt(daily.value, day.value));
const rate = computed(() => weeklyRate(daily.value, day.value));
const tone = computed(() => rateTone(rate.value, avg7.value));

// ---------- Eiweiß ----------

const grams = computed(() => log.value?.proteinG ?? 0);
const target = computed(() => proteinTarget(latestWeight.value));
const left = computed(() => proteinLeft(grams.value, target.value?.goal ?? null));
const pct = computed(() => (target.value ? Math.min(1, grams.value / target.value.goal) : 0));
const RING = 2 * Math.PI * 34;
/** Rückgängig: letzte Eingaben dieses Tages (nur in dieser Sitzung). */
const undo = ref<{ day: string; grams: number }[]>([]);
function add(g: number) {
  athlete.addProtein(g, day.value);
  undo.value = [...undo.value, { day: day.value, grams: g }].slice(-10);
  haptic();
}
const lastAdd = computed(() => [...undo.value].reverse().find((u) => u.day === day.value) ?? null);
function undoLast() {
  const u = lastAdd.value;
  if (!u) return;
  athlete.addProtein(-u.grams, day.value);
  const i = undo.value.lastIndexOf(u);
  undo.value = undo.value.filter((_, k) => k !== i);
}
const custom = ref<number | null>(null);
function addCustom() {
  if (custom.value == null || custom.value <= 0 || custom.value > 200) return;
  add(Math.round(custom.value));
  custom.value = null;
}
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="body-card">
      <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
              <h2 class="display text-2xl text-white">{{ t('body.title') }}</h2>
          </div>
      </div>

      <!-- Tag: heute oder nachtragen -->
      <div class="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" :aria-label="t('wellness.day')" data-test="body-days">
          <button v-for="d in days" :key="d.day" type="button" role="radio" :aria-checked="day === d.day" :data-day="d.day"
                  class="relative flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors"
                  :class="day === d.day ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'" @click="day = d.day">
              {{ label(d.day, d.i) }}
              <span v-if="d.weight" class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true"></span>
          </button>
      </div>

      <!-- Gewicht -->
      <div class="body-tile mt-3" data-test="weight">
          <div class="flex items-center justify-between gap-3">
              <span class="body-tile-label">{{ t('body.weight') }}</span>
              <span v-if="avg7 != null" class="font-mono text-[11px] text-slate-400">{{ t('body.avg7', { v: fmtKg(avg7) }) }}</span>
          </div>
          <div v-if="!showForm" class="mt-1 flex items-center justify-between gap-3">
              <p class="font-mono text-4xl font-black tabular-nums text-white" data-test="weight-latest">{{ fmtKg(log!.weightKg!) }}<span class="ml-1 text-base text-slate-400">kg</span></p>
              <button type="button" class="routine-link" data-test="weight-edit" @click="startEdit">{{ t('common.edit') }}</button>
          </div>
          <form v-else class="mt-2" @submit.prevent="saveWeight">
              <div class="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <button type="button" class="body-step" :aria-label="t('body.minus01')" @click="step(-0.1)">−</button>
                  <DecimalInput v-model="draft" class="field h-14 min-w-0 rounded-xl px-3 text-center font-mono text-2xl font-black" :placeholder="base != null ? fmtKg(base) : t('body.weightPlaceholder')" :aria-label="t('body.weightOn')" data-test="weight-input" />
                  <button type="button" class="body-step" :aria-label="t('body.plus01')" @click="step(0.1)">+</button>
              </div>
              <button type="submit" class="btn-primary mt-2 h-12 w-full rounded-xl text-sm" :disabled="!weightValid" data-test="weight-save">✓ {{ t('body.saveWeight') }}</button>
          </form>
          <p v-if="rate != null" class="mt-2 text-[11px] leading-snug" :class="tone === 'fast' ? 'text-amber-300' : 'text-slate-300'" data-test="weight-rate">
              <span class="font-mono font-bold">{{ rate > 0 ? '+' : rate < 0 ? '−' : '±' }}{{ fmtKg(Math.abs(rate)) }} kg / {{ t('body.week') }}</span> <template v-if="tone">· {{ t(`body.rate.${tone}`) }}</template>
          </p>
          <p v-else class="mt-2 text-[11px] leading-snug text-slate-500">{{ t('body.weightHint') }}</p>
      </div>

      <!-- Eiweiß -->
      <div class="body-tile mt-3" data-test="protein">
          <div class="flex items-center gap-4">
              <div class="relative h-[84px] w-[84px] flex-shrink-0">
                  <svg viewBox="0 0 80 80" class="h-full w-full -rotate-90" role="img" :aria-label="t('body.proteinRing', { n: grams, goal: target?.goal ?? '–' })">
                      <circle cx="40" cy="40" r="34" class="todo-ring-track" stroke-width="7" fill="none" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke-width="7" stroke-linecap="round" :class="pct >= 1 ? 'body-ring-done' : 'body-ring'" :style="{ strokeDasharray: RING, strokeDashoffset: RING * (1 - pct) }" />
                  </svg>
                  <span class="absolute inset-0 flex flex-col items-center justify-center">
                      <span class="font-mono text-xl font-black leading-none text-white" data-test="protein-today">{{ grams }}</span>
                      <span class="font-mono text-tiny text-slate-400">/ {{ target?.goal ?? '–' }} {{ t('units.g') }}</span>
                  </span>
              </div>
              <div class="min-w-0 flex-1">
                  <span class="body-tile-label">{{ t('body.protein') }}</span>
                  <p v-if="left && left.grams" class="mt-1 text-xs leading-snug text-slate-300">{{ t('body.proteinLeft', { g: left.grams, meals: left.meals }) }}</p>
                  <p v-else-if="left" class="mt-1 text-xs font-bold text-emerald-300">{{ t('body.proteinDone') }}</p>
                  <p v-else class="mt-1 text-xs text-slate-400">{{ t('body.proteinNoWeight') }}</p>
                  <!-- Platz für "Rückgängig" immer reserviert: sonst rutscht beim Hinzufügen alles darunter (auch das Eingabefeld) nach unten -->
                  <div class="mt-1 h-9">
                      <button v-if="lastAdd" type="button" class="routine-link -ml-3" data-test="protein-undo" @click="undoLast">↺ {{ t('body.undo', { g: lastAdd.grams }) }}</button>
                  </div>
              </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-4">
              <button v-for="f in FOODS" :key="f.id" type="button" class="food-btn" :data-protein="f.id" :aria-label="`${t(`body.foods.${f.id}`)}: +${f.grams} ${t('units.g')}`" @click="add(f.grams)">
                  <span class="block text-[11px] font-bold leading-tight text-white">{{ t(`body.foods.${f.id}`) }}</span>
                  <span class="block font-mono text-[11px] text-accent">+{{ f.grams }} {{ t('units.g') }}</span>
              </button>
          </div>
          <form class="mt-2 flex items-center gap-2" @submit.prevent="addCustom">
              <DecimalInput v-model="custom" integer class="field h-11 min-w-0 flex-1 rounded-xl px-3 font-mono" :placeholder="t('body.customPlaceholder')" :aria-label="t('body.customLabel')" data-test="protein-custom" />
              <button type="submit" class="btn-secondary h-11 flex-shrink-0 rounded-xl px-4 text-sm" :disabled="!custom" data-test="protein-add">+ {{ t('body.add') }}</button>
          </form>
          <p v-if="target" class="mt-2 text-tiny leading-snug text-slate-500">{{ t('body.proteinTarget', { min: target.min, max: target.max }) }}</p>
      </div>
  </section>
</template>
