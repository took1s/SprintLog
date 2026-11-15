<script setup lang="ts">
// Abschluss: Bestwert je Test mit Niveau für die eigene Position und Vergleich zum letzten Test (Rekord markiert).
// Speichern legt die Ergebnisse an (Notiz = alle Versuche + Messart); Verwerfen löscht den Testtag.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { intlLocale, t, tn } from '@/i18n';
import { useAthleteStore, type TestDaySession } from '@/stores/athlete';
import { useAiStore } from '@/stores/ai';
import { useUiStore } from '@/stores/ui';
import { TESTS, formatValue, history, rate, type Position, type TestId } from '@/lib/fitnessTests';
import { BLOCKS, bestOf, type Endurance } from '@/lib/testDay';

const props = defineProps<{ session: TestDaySession }>();
const emit = defineEmits<{ (e: 'back'): void }>();
const athlete = useAthleteStore();
const ui = useUiStore();
const { tests } = storeToRefs(athlete);
const position = computed(() => (useAiStore().profile.position as Position | null) ?? null);

const rows = computed(() => {
  const out: { id: TestId; value: number; attempts: number; level: ReturnType<typeof rate>['level']; prev: number | null; record: boolean; change: number | null }[] = [];
  for (const b of props.session.blocks) {
    if (props.session.skipped.includes(b)) continue;
    const values: Partial<Record<TestId, number>> = BLOCKS[b].kind === 'endurance'
      ? (props.session.endurance[b as Endurance]?.result != null ? { [b]: props.session.endurance[b as Endurance]!.result! } : {})
      : bestOf(props.session.attempts[b] ?? [], BLOCKS[b].tests);
    for (const id of BLOCKS[b].tests) {
      const v = values[id];
      if (v == null) continue;
      // Vergleich nur mit früheren Testtagen
      const h = history(tests.value.filter((r) => r.day < props.session.day), id);
      const lower = TESTS[id].lowerIsBetter;
      const change = h.last ? Math.round((lower ? h.last.value - v : v - h.last.value) * 100) / 100 : null;
      out.push({
        id, value: v, attempts: BLOCKS[b].kind === 'endurance' ? 1 : (props.session.attempts[b]?.length ?? 0), level: rate(id, v, position.value).level,
        prev: h.last?.value ?? null, record: !!h.best && (lower ? v < h.best.value : v > h.best.value), change,
      });
    }
  }
  return out;
});

const fmt = (id: TestId, v: number) => formatValue(id, v, intlLocale());
const unit = (id: TestId) => t(`tests.units.${TESTS[id].unit}`);
const minutes = computed(() => Math.max(1, Math.round((Date.now() - props.session.startedAt) / 60_000)));

function save() {
  const n = athlete.finishTestDay();
  ui.toast(n ? t('testDay.summary.saved', { n }) : t('testDay.summary.nothing'), n ? 'success' : 'info');
}

async function discard() {
  if (await ui.confirm({ title: t('testDay.summary.discardTitle'), message: t('testDay.summary.discardText'), confirmText: t('testDay.summary.discard'), danger: true })) athlete.discardTestDay();
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden" data-test="test-day-summary">
      <div class="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <h2 class="display text-3xl leading-tight text-white">{{ t('testDay.summary.title') }}</h2>
          <p class="mt-1 text-xs text-slate-400">{{ t('testDay.summary.meta', { min: minutes }) }}<template v-if="session.timing === 'stopwatch'"> · {{ t('testDay.summary.hand') }}</template></p>
          <ul v-if="rows.length" class="mt-4 space-y-2">
              <li v-for="r in rows" :key="r.id" class="rounded-2xl border border-white/10 bg-white/[0.03] p-3" :data-summary="r.id">
                  <div class="flex items-center gap-3">
                      <span class="min-w-0 flex-1">
                          <span class="block text-sm font-bold text-white">{{ t(`tests.names.${r.id}`) }}</span>
                          <span class="block font-mono text-[11px] text-slate-400">
                              {{ r.attempts > 1 ? tn('testDay.summary.attempts', r.attempts) : '' }}
                              <template v-if="r.prev != null"><template v-if="r.attempts > 1"> · </template>{{ t('testDay.summary.prev', { v: fmt(r.id, r.prev) }) }}</template>
                          </span>
                      </span>
                      <span class="text-right">
                          <span class="block font-mono text-xl font-black text-white">{{ fmt(r.id, r.value) }}<span class="ml-0.5 text-xs text-slate-400">{{ unit(r.id) }}</span></span>
                          <span v-if="r.change != null && r.change !== 0" class="block font-mono text-[11px]" :class="r.change > 0 ? 'text-emerald-300' : 'text-amber-300'">{{ r.change > 0 ? '↑' : '↓' }}{{ fmt(r.id, Math.abs(r.change)) }}</span>
                      </span>
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                      <span class="level-chip" :class="`is-${r.level}`">{{ t(`tests.levels.${r.level}`) }}</span>
                      <span v-if="r.record" class="text-[10px] font-bold uppercase tracking-label text-yellow-300">★ {{ t('testDay.summary.record') }}</span>
                  </div>
              </li>
          </ul>
          <p v-else class="mt-6 rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-300">{{ t('testDay.summary.empty') }}</p>
          <button type="button" class="routine-link mt-4" @click="emit('back')">← {{ t('testDay.summary.back') }}</button>
      </div>
      <footer class="grid grid-cols-[auto_1fr] gap-3 px-5 pt-2" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
          <button type="button" class="btn-secondary h-14 rounded-2xl px-4 text-sm" data-test="summary-discard" @click="discard">{{ t('testDay.summary.discard') }}</button>
          <button type="button" class="btn-primary h-14 rounded-2xl text-base" :disabled="!rows.length" data-test="summary-save" @click="save">✓ {{ t('testDay.summary.save') }}</button>
      </footer>
  </div>
</template>
