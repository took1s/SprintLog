<script setup lang="ts">
// Zusatz-Einheit planen/bearbeiten: Tag (freie Tage als Chips, Plan-/Spieltage gesperrt), Name, Art, Hinweise, Übungen
// mit Vorgaben passend zur Erfassungsart (Sätze × Wdh. @ kg, Strecke, Zeit).
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t } from '@/i18n';
import { categoryName, exerciseName, muscleName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { cleanPlanned, usePlannedStore } from '@/stores/planned';
import { MAX_PLANNED_EXERCISES, freeDays, planConflict } from '@/lib/planned';
import { addDays, parseDay } from '@/lib/routines';
import { vSheetDrag } from '@/lib/gestures';

const app = useAppStore();
const planned = usePlannedStore();
const { editor, schedule, items, today } = storeToRefs(planned);
const { exercises } = storeToRefs(app);
const d = computed(() => editor.value.draft);
const status = computed(() => (editor.value.clientId ? planned.byId(editor.value.clientId)?.status ?? 'planned' : 'planned'));

const short = (day: string) => parseDay(day).toLocaleDateString(intlLocale(), { weekday: 'short', day: 'numeric' });
const free = computed(() => freeDays(schedule.value, items.value, today.value, 10, editor.value.clientId));
const conflict = computed(() => (status.value === 'planned' ? planConflict(schedule.value, d.value.date) : null));
const taken = computed(() => status.value === 'planned' && items.value.some((p) => p.pending !== 'delete' && p.status === 'planned' && p.date === d.value.date && p.clientId !== editor.value.clientId));
/** Spieltag blockiert; Trainingstag ist ein erlaubter Doppeltag (nur Hinweis). */
const blocked = computed(() => conflict.value === 'match');
const valid = computed(() => { const c = cleanPlanned(d.value); return !!c.title && c.exercises.length > 0 && !blocked.value; });
const tried = ref(false);

// ---------- Übungen ----------
const query = ref('');
const searching = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const matches = computed(() => (searching.value ? app.searchExercises(query.value, exercises.value).slice(0, 8) : []));
const typeOf = (id: number) => app.exerciseFor(id)?.trackingType ?? 'WeightReps';

function startSearch() {
  searching.value = true;
  query.value = '';
  void nextTick(() => searchInput.value?.focus());
}
function addExercise(id: number) {
  const type = typeOf(id);
  d.value.exercises.push(type === 'WeightReps' ? { exerciseId: id, sets: 3, repsMin: 8, repsMax: 10 }
    : type === 'DistanceTime' ? { exerciseId: id, sets: 4, distance: 30 }
      : { exerciseId: id, sets: 3, time: type === 'Cardio' ? 1200 : 45 });
  if (!d.value.title.trim() && d.value.exercises.length === 1) d.value.category = app.exerciseFor(id)?.category === 'Football' ? 'Football' : 'Gym';
  searching.value = false;
}
const removeExercise = (i: number) => d.value.exercises.splice(i, 1);

watch(() => editor.value.open, (open) => { if (open) { tried.value = false; searching.value = false; } });

function save() {
  tried.value = true;
  if (valid.value) planned.save();
}
</script>

<template>
  <transition name="sheet">
      <div v-if="editor.open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="planned.close()" @keydown.esc.stop="planned.close()">
          <form v-sheet-drag:handle="() => planned.close()" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
                role="dialog" aria-modal="true" aria-labelledby="planned-sheet-title" data-test="planned-sheet" @submit.prevent="save">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('planned.title') }}</p>
                      <h2 id="planned-sheet-title" class="display mt-1 break-words text-2xl leading-tight text-white">{{ editor.clientId ? t('planned.sheet.editTitle') : t('planned.sheet.newTitle') }}</h2>
                  </div>
                  <button type="button" @click="planned.close()" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 overflow-y-auto px-6 pb-4">
                  <!-- Tag -->
                  <label class="label-xs mb-2" for="planned-date">{{ t('planned.sheet.date') }}</label>
                  <input id="planned-date" v-model="d.date" type="date" required :min="today" :max="addDays(today, 180)" class="field h-12 w-full rounded-xl px-3" data-test="planned-date">
                  <p v-if="conflict === 'match'" class="mt-2 text-xs font-bold text-red-300" role="alert" data-test="planned-conflict">{{ t('planned.sheet.matchDay') }}</p>
                  <!-- Trainingstag des Plans: ersetzen (nur dieses Datum, Plan bleibt) oder zusätzlich (Doppeltag) -->
                  <div v-else-if="conflict === 'training'" class="mt-2" data-test="planned-training-day">
                      <div class="grid grid-cols-2 gap-1.5" role="radiogroup" :aria-label="t('planned.sheet.onPlanDay')">
                          <button type="button" role="radio" :aria-checked="!!d.replacesPlan" data-test="planned-replace" @click="d.replacesPlan = true"
                                  class="min-h-[2.75rem] rounded-xl border px-2 py-2 text-xs font-bold leading-tight transition-colors"
                                  :class="d.replacesPlan ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ t('planned.sheet.replace') }}</button>
                          <button type="button" role="radio" :aria-checked="!d.replacesPlan" data-test="planned-extra" @click="d.replacesPlan = false"
                                  class="min-h-[2.75rem] rounded-xl border px-2 py-2 text-xs font-bold leading-tight transition-colors"
                                  :class="!d.replacesPlan ? 'border-amber-400/60 bg-amber-400/10 text-amber-300' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ t('planned.sheet.extra') }}</button>
                      </div>
                      <p class="mt-1.5 text-[11px] leading-snug" :class="d.replacesPlan ? 'text-slate-400' : 'font-bold text-amber-300'" role="status" :data-test="d.replacesPlan ? 'planned-replace-hint' : 'planned-double'">
                          {{ d.replacesPlan ? t('planned.sheet.replaceHint') : t('planned.sheet.doubleDay') }}
                      </p>
                  </div>
                  <p v-else-if="taken" class="mt-2 text-xs text-yellow-300">{{ t('planned.sheet.takenDay') }}</p>
                  <p class="mt-3 text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('planned.sheet.freeDays') }}</p>
                  <div class="no-scrollbar -mx-6 mt-1.5 flex gap-1.5 overflow-x-auto px-6" role="group" :aria-label="t('planned.sheet.freeDays')">
                      <button v-for="f in free" :key="f.day" type="button" class="planned-day-chip" :class="{ 'is-on': d.date === f.day }" :aria-pressed="d.date === f.day"
                              :title="f.beforeMatch ? t('planned.sheet.beforeMatch') : undefined" :data-free="f.day" @click="d.date = f.day">
                          <span>{{ short(f.day) }}</span>
                          <i v-if="f.beforeMatch" class="planned-md1" aria-hidden="true">MD-1</i>
                      </button>
                  </div>

                  <label class="label-xs mb-2 mt-5" for="planned-title">{{ t('planned.sheet.name') }}</label>
                  <input id="planned-title" v-model="d.title" type="text" maxlength="60" class="field h-12 w-full rounded-xl px-4" :placeholder="t('planned.sheet.namePlaceholder')" data-test="planned-title">

                  <p class="label-xs mb-2 mt-5" id="planned-cat">{{ t('planned.sheet.category') }}</p>
                  <div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="planned-cat">
                      <button v-for="c in (['Gym', 'Football'] as const)" :key="c" type="button" class="chip min-h-[2.75rem] justify-center" :class="d.category === c ? 'chip-active' : 'chip-idle'"
                              :aria-pressed="d.category === c" :data-category="c" @click="d.category = c">{{ categoryName(c) }}</button>
                  </div>

                  <!-- Übungen -->
                  <p class="label-xs mb-2 mt-5">{{ t('planned.sheet.exercises') }}</p>
                  <ol class="space-y-2" data-test="planned-exercises">
                      <li v-for="(x, i) in d.exercises" :key="`${x.exerciseId}-${i}`" class="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div class="flex items-center gap-2">
                              <span class="routine-step-no" aria-hidden="true">{{ i + 1 }}</span>
                              <span class="min-w-0 flex-1 truncate text-sm font-bold text-white">{{ exerciseName(app.exerciseFor(x.exerciseId) ?? x.exerciseId) }}</span>
                              <button type="button" class="routine-icon-btn !h-9 !w-9 hover:!text-red-300" :aria-label="t('planned.sheet.remove', { name: exerciseName(app.exerciseFor(x.exerciseId) ?? x.exerciseId) })" @click="removeExercise(i)">✕</button>
                          </div>
                          <div class="mt-2 grid grid-cols-3 gap-2 pl-8 font-mono text-[10px] text-slate-400">
                              <label>{{ t('planned.sheet.sets') }}<input v-model.number="x.sets" type="number" inputmode="numeric" min="1" max="20" class="field mt-1 h-10 w-full rounded-lg px-2 text-sm" data-test="planned-sets"></label>
                              <template v-if="typeOf(x.exerciseId) === 'WeightReps'">
                                  <label>{{ t('planned.sheet.reps') }}<input v-model.number="x.repsMin" type="number" inputmode="numeric" min="1" max="100" class="field mt-1 h-10 w-full rounded-lg px-2 text-sm"></label>
                                  <label>{{ t('planned.sheet.weight') }}<input v-model.number="x.weight" type="number" inputmode="decimal" min="0" max="1000" step="0.5" class="field mt-1 h-10 w-full rounded-lg px-2 text-sm" :placeholder="t('common.optional')"></label>
                              </template>
                              <label v-else-if="typeOf(x.exerciseId) === 'DistanceTime'" class="col-span-2">{{ t('planned.sheet.distance') }}<input v-model.number="x.distance" type="number" inputmode="numeric" min="1" max="100000" class="field mt-1 h-10 w-full rounded-lg px-2 text-sm"></label>
                              <label v-else class="col-span-2">{{ t('planned.sheet.time') }}<input v-model.number="x.time" type="number" inputmode="numeric" min="1" max="36000" class="field mt-1 h-10 w-full rounded-lg px-2 text-sm"></label>
                          </div>
                      </li>
                  </ol>
                  <div v-if="searching" class="mt-2">
                      <input ref="searchInput" v-model="query" type="search" class="field h-11 w-full rounded-xl px-3 text-sm" :placeholder="t('planned.sheet.search')" :aria-label="t('planned.sheet.search')" data-test="planned-search">
                      <ul class="mt-1 max-h-56 overflow-y-auto">
                          <li v-for="e in matches" :key="e.id">
                              <button type="button" class="flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-lg px-2 text-left hover:bg-white/5" :data-pick="e.id" @click="addExercise(e.id)">
                                  <span class="min-w-0 truncate text-sm font-bold text-white">{{ exerciseName(e) }}</span>
                                  <span class="flex-shrink-0 font-mono text-[10px] text-slate-500">{{ muscleName(e.muscleGroup) }}</span>
                              </button>
                          </li>
                      </ul>
                  </div>
                  <button v-else-if="d.exercises.length < MAX_PLANNED_EXERCISES" type="button" class="btn-ghost mt-2 w-full rounded-xl py-3 text-xs" data-test="planned-add-exercise" @click="startSearch">+ {{ t('planned.sheet.addExercise') }}</button>

                  <label class="label-xs mb-2 mt-5" for="planned-notes">{{ t('planned.sheet.notes') }} <span class="normal-case tracking-normal text-slate-500">({{ t('common.optional') }})</span></label>
                  <textarea id="planned-notes" v-model="d.notes" rows="2" maxlength="300" class="field w-full resize-none rounded-xl px-4 py-3 text-sm" :placeholder="t('planned.sheet.notesPlaceholder')"></textarea>
                  <p v-if="tried && !valid && !blocked" class="mt-3 text-xs font-bold text-red-300" role="alert">{{ t('planned.sheet.invalid') }}</p>
              </div>

              <div class="flex gap-2 border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <button v-if="editor.clientId" type="button" class="btn-ghost rounded-xl px-3 py-4 text-sm text-red-400" data-test="planned-delete" @click="planned.remove(editor.clientId)">{{ t('common.delete') }}</button>
                  <button type="submit" class="btn-primary flex-1 rounded-xl py-4 text-sm" :aria-disabled="!valid" data-test="planned-save">{{ t('common.save') }}</button>
              </div>
          </form>
      </div>
  </transition>
</template>
