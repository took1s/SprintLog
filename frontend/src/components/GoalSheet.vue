<script setup lang="ts">
import DecimalInput from '@/components/DecimalInput.vue';
// Kraft-Ziel anlegen/bearbeiten: Übung wählen, Zielgewicht × Wdh., Startwert, Steigerung, optional Wunschdatum.
// Unten steht live die erste Vorgabe und wie realistisch das Datum ist - man sieht sofort, was die App daraus macht.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { exerciseName, muscleName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { useGoalsStore } from '@/stores/goals';
import { dateRealism, goalSessions, nextPrescription, targetE1RM, type LiftGoal } from '@/lib/goals';
import { prescriptionLabel } from '@/lib/goalText';
import { formatNumber } from '@/lib/format';
import { vSheetDrag } from '@/lib/gestures';

const app = useAppStore();
const goals = useGoalsStore();
const { draft } = storeToRefs(goals);
const { allWorkouts, clockDate, exercises, usage } = storeToRefs(app);
const { exerciseFor, searchExercises } = app;

const REPS = [1, 3, 5, 8, 10] as const;
const INCREMENTS = [1, 1.25, 2.5, 5] as const;

const query = ref('');
watch(() => draft.value.open, (open) => { if (open) query.value = ''; });

const ex = computed(() => (draft.value.exerciseId != null ? exerciseFor(draft.value.exerciseId) : null));

/** Auswahlliste: nur Gewicht × Wdh., meistgenutzte zuerst. */
const candidates = computed(() => {
  const list = exercises.value.filter((e) => e.trackingType === 'WeightReps' && !goals.byExercise.has(e.id));
  const used = (id: number) => usage.value.get(`id:${id}`) ?? 0;
  const found = query.value.trim() ? searchExercises(query.value, list) : [...list].sort((a, b) => used(b.id) - used(a.id));
  return found.slice(0, 40);
});

function choose(id: number) {
  goals.openGoal(id);
}

function stepWeight(delta: number) {
  draft.value.targetWeight = Math.max(0, Math.round((Number(draft.value.targetWeight) + delta) * 100) / 100);
}

const today = computed(() => clockDate.value.toISOString().slice(0, 10));

/** Vorschau: so sähe die erste Einheit mit diesen Werten aus. */
const preview = computed(() => {
  const d = draft.value;
  if (d.exerciseId == null || !(d.targetWeight > 0)) return null;
  const goal: LiftGoal = {
    exerciseId: d.exerciseId, targetWeight: d.targetWeight, targetReps: d.targetReps, increment: d.increment,
    startE1RM: d.startE1RM, targetDate: d.targetDate || null, createdAt: new Date().toISOString(), achievedAt: null,
  };
  const next = nextPrescription(goal, goalSessions(allWorkouts.value, d.exerciseId));
  return { goal, next, target: targetE1RM(goal) };
});

const tooEasy = computed(() => !!preview.value && !!draft.value.startE1RM && preview.value.target <= draft.value.startE1RM);
const realism = computed(() => {
  const d = draft.value;
  if (!d.targetDate || !d.startE1RM || !preview.value) return null;
  return dateRealism(d.startE1RM, preview.value.target, d.targetDate, clockDate.value);
});
const realismClass = computed(() => ({ ok: 'text-emerald-400', ambitious: 'text-orange-300', unrealistic: 'text-red-400' })[realism.value ?? 'ok']);
</script>

<template>
  <transition name="sheet">
      <div v-if="draft.open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="goals.closeGoal()">
          <div v-sheet-drag:handle="() => goals.closeGoal()" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="t('goals.sheetTitle')" data-test="goal-sheet">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('goals.sheetTitle') }}</p>
                      <h2 class="display mt-1 truncate text-2xl text-white">{{ ex ? exerciseName(ex) : t('goals.pick') }}</h2>
                  </div>
                  <button type="button" @click="goals.closeGoal()" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <!-- Schritt 1: Übung wählen -->
              <template v-if="!ex">
                  <div class="px-6">
                      <input v-model="query" type="search" class="field h-12 w-full rounded-xl px-4" :placeholder="t('picker.search')" :aria-label="t('picker.search')" data-test="goal-search">
                  </div>
                  <ul class="mt-2 flex-1 overflow-y-auto px-3 pb-6">
                      <li v-for="e in candidates" :key="e.id">
                          <button type="button" @click="choose(e.id)" class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5" :data-goal-pick="e.id">
                              <span class="min-w-0">
                                  <span class="block truncate font-bold text-white">{{ exerciseName(e) }}</span>
                                  <span class="block truncate font-mono text-[11px] text-slate-500">{{ muscleName(e.muscleGroup) }}</span>
                              </span>
                              <span class="text-slate-500" aria-hidden="true">›</span>
                          </button>
                      </li>
                  </ul>
              </template>

              <!-- Schritt 2: Werte -->
              <template v-else>
                  <div class="flex-1 overflow-y-auto px-6 pb-4">
                      <label class="label-xs mb-2" for="goal-weight">{{ t('goals.targetWeight') }}</label>
                      <div class="stepper">
                          <button type="button" @click="stepWeight(-draft.increment)" class="stepper-btn" :aria-label="t('set.decrease', { what: t('set.fields.weight') })">-</button>
                          <DecimalInput id="goal-weight" :model-value="draft.targetWeight" @update:model-value="draft.targetWeight = $event ?? 0" class="stepper-input" data-test="goal-weight" />
                          <button type="button" @click="stepWeight(draft.increment)" class="stepper-btn" :aria-label="t('set.increase', { what: t('set.fields.weight') })">+</button>
                      </div>

                      <div class="label-xs mb-2 mt-5">{{ t('goals.targetReps') }}</div>
                      <div class="flex gap-2">
                          <button v-for="r in REPS" :key="r" type="button" @click="draft.targetReps = r" class="preset-btn flex-1" :class="{ '!border-accent/60 !text-accent': draft.targetReps === r }" :aria-pressed="draft.targetReps === r">
                              {{ r === 1 ? t('goals.oneRm') : '×' + r }}
                          </button>
                      </div>

                      <label class="label-xs mb-2 mt-5" for="goal-start">{{ t('goals.current') }}</label>
                      <div class="flex items-center gap-3">
                          <DecimalInput id="goal-start" v-model="draft.startE1RM" class="field h-12 w-32 rounded-xl px-4 font-mono text-lg font-bold" data-test="goal-start" />
                          <span class="text-xs leading-snug text-slate-500">{{ goals.estimateFor(ex.id) ? t('goals.currentHint') : t('goals.currentUnknown') }}</span>
                      </div>

                      <div class="label-xs mb-2 mt-5">{{ t('goals.increment') }}</div>
                      <div class="flex gap-2">
                          <button v-for="inc in INCREMENTS" :key="inc" type="button" @click="draft.increment = inc" class="preset-btn flex-1" :class="{ '!border-accent/60 !text-accent': draft.increment === inc }" :aria-pressed="draft.increment === inc">
                              +{{ formatNumber(inc, 2) }}
                          </button>
                      </div>

                      <label class="label-xs mb-2 mt-5" for="goal-date">{{ t('goals.date') }} <span class="normal-case tracking-normal text-slate-500">({{ t('common.optional') }})</span></label>
                      <input id="goal-date" v-model="draft.targetDate" type="date" :min="today" class="field h-12 w-full rounded-xl px-4">
                      <p v-if="realism" class="mt-2 text-xs font-bold" :class="realismClass">{{ t(`goals.realism.${realism}`) }}</p>

                      <!-- Vorschau -->
                      <div v-if="preview" class="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4" data-test="goal-preview">
                          <div class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('goals.next') }}</div>
                          <div class="mt-1 font-mono text-sm font-bold text-white">{{ prescriptionLabel(preview.next, preview.goal) }}</div>
                          <p v-if="tooEasy" class="mt-1 text-xs text-orange-300">{{ t('goals.tooEasy') }}</p>
                          <p class="mt-2 text-xs leading-relaxed text-slate-400">{{ t('goals.howItWorks') }}</p>
                      </div>
                  </div>

                  <div class="flex gap-2 border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                      <button v-if="draft.editing" type="button" @click="goals.removeGoal(ex.id)" class="btn-ghost rounded-xl px-4 py-4 text-sm text-red-400">{{ t('common.delete') }}</button>
                      <button type="button" @click="goals.saveGoal()" :disabled="!(draft.targetWeight > 0)" class="btn-primary flex-1 rounded-xl py-4 text-sm" data-test="goal-save">{{ t('common.save') }}</button>
                  </div>
              </template>
          </div>
      </div>
  </transition>
</template>
