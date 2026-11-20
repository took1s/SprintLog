<script setup lang="ts">
// Testtag eintragen: Datum, Reihenfolge wie empfohlen (frisch zuerst: Sprung, Sprint, Richtungswechsel, Ausdauer am Schluss).
// Leere Felder werden nicht gespeichert; ein Test kann einzeln geöffnet werden.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAthleteStore } from '@/stores/athlete';
import { useUiStore } from '@/stores/ui';
import { TESTS, type TestId } from '@/lib/fitnessTests';
import { vSheetDrag } from '@/lib/gestures';
import DecimalInput from '@/components/DecimalInput.vue';

const athlete = useAthleteStore();
const { testSheet, today } = storeToRefs(athlete);
const ORDER: TestId[] = ['cmj', 'sprint10', 'sprint30', 'agility', 'yoyo', 'ift'];
const shown = computed(() => (testSheet.value.only ? [testSheet.value.only] : ORDER));
const values = ref<Partial<Record<TestId, number | null>>>({});
const day = ref(today.value);
watch(() => testSheet.value.open, (open) => {
  if (!open) return;
  day.value = testSheet.value.day;
  // Schon eingetragene Werte dieses Tages vorbelegen (Bearbeiten)
  values.value = Object.fromEntries(athlete.tests.filter((r) => r.day === day.value && r.pending !== 'delete').map((r) => [r.test, r.value]));
}, { immediate: true });

const invalid = (id: TestId) => { const v = values.value[id]; return v != null && (v < TESTS[id].min || v > TESTS[id].max); };
const anyInvalid = computed(() => shown.value.some(invalid));
const filled = computed(() => shown.value.filter((id) => values.value[id] != null).length);

function save() {
  if (anyInvalid.value) return;
  const patch = Object.fromEntries(shown.value.map((id) => [id, values.value[id] ?? null])) as Partial<Record<TestId, number | null>>;
  const n = athlete.saveResults(day.value, patch);
  athlete.closeTests();
  if (n) useUiStore().toast(t('tests.toast.saved', { n }), 'success');
}
</script>

<template>
  <transition name="sheet">
      <div v-if="testSheet.open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="athlete.closeTests()" @keydown.esc.stop="athlete.closeTests()">
          <form v-sheet-drag:handle="() => athlete.closeTests()" class="glass-panel modal-panel flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
                role="dialog" aria-modal="true" aria-labelledby="test-sheet-title" data-test="test-sheet" @submit.prevent="save">
              <div class="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
                  <div>
                      <h2 id="test-sheet-title" class="display mt-1 text-2xl text-white">{{ testSheet.only ? t(`tests.names.${testSheet.only}`) : t('tests.sheetTitle') }}</h2>
                  </div>
                  <button type="button" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')" @click="athlete.closeTests()">✕</button>
              </div>
              <div class="flex-1 overflow-y-auto px-6 pb-4">
                  <label class="label-xs mb-2 mt-2 block" for="test-day">{{ t('tests.day') }}</label>
                  <input id="test-day" v-model="day" type="date" :max="today" class="field h-12 w-full rounded-xl px-3" data-test="test-day">
                  <p v-if="!testSheet.only" class="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] leading-relaxed text-slate-300">{{ t('tests.orderHint') }}</p>
                  <div class="mt-3 space-y-3">
                      <div v-for="id in shown" :key="id" class="rounded-2xl border border-white/10 bg-white/[0.03] p-3" :data-test-input="id">
                          <div class="flex items-center justify-between gap-3">
                              <label :for="`test-${id}`" class="min-w-0 text-sm font-bold text-white">{{ t(`tests.names.${id}`) }}</label>
                              <div class="flex flex-shrink-0 items-center gap-1.5">
                                  <DecimalInput :id="`test-${id}`" v-model="values[id]" :integer="TESTS[id].decimals === 0" class="field h-11 w-24 rounded-xl px-2 text-center font-mono" :class="{ '!border-red-400': invalid(id) }" />
                                  <span class="w-10 text-xs font-bold text-slate-400">{{ t(`tests.units.${TESTS[id].unit}`) }}</span>
                              </div>
                          </div>
                          <p class="mt-1.5 text-[11px] leading-snug" :class="invalid(id) ? 'text-red-300' : 'text-slate-500'">{{ invalid(id) ? t('tests.range', { min: TESTS[id].min, max: TESTS[id].max }) : t(`tests.short.${id}`) }}</p>
                      </div>
                  </div>
              </div>
              <div class="border-t border-white/10 px-6 py-4">
                  <button type="submit" class="btn-primary w-full rounded-xl py-4 text-sm" :aria-disabled="anyInvalid || !filled" data-test="test-save">{{ t('tests.save') }}</button>
              </div>
          </form>
      </div>
  </transition>
</template>
