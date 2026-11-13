<script setup lang="ts">
// Routinen im Plan-Tab: laufende und kommende mit Fortschritt im Zeitraum, beendete eingeklappt. Tippen = bearbeiten.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { useRoutinesStore } from '@/stores/routines';
import RoutineMeta from './RoutineMeta.vue';

const routines = useRoutinesStore();
const { visible } = storeToRefs(routines);
const current = computed(() => visible.value.filter((r) => routines.progressOf(r).state !== 'ended'));
const ended = computed(() => visible.value.filter((r) => routines.progressOf(r).state === 'ended'));

/** Fortschritt im Zeitraum (mit Ende) bzw. Erfüllung der letzten 2 Wochen (ohne Ende). */
function bar(clientId: string) {
  const r = routines.byId(clientId);
  if (!r) return 0;
  const p = routines.progressOf(r);
  if (p.total) return Math.round((p.done / p.total) * 100);
  return p.adherence ?? 0;
}
</script>

<template>
  <section class="glass-panel rounded-3xl p-5" data-test="routines-panel">
      <div class="mb-4 flex items-center justify-between gap-3">
          <div>
              <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('routines.kicker') }}</p>
              <h2 class="display text-2xl text-white">{{ t('routines.title') }}</h2>
          </div>
          <button type="button" @click="routines.openNew()" class="btn-secondary flex-shrink-0 rounded-xl px-4 py-2.5 text-xs" data-test="routine-new">+ {{ t('routines.add') }}</button>
      </div>

      <p v-if="!visible.length" class="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm leading-relaxed text-slate-400">{{ t('routines.empty') }}</p>

      <ul v-if="current.length" class="space-y-3">
          <li v-for="r in current" :key="r.clientId">
              <button type="button" @click="routines.openEdit(r.clientId)" class="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/5" :data-routine-row="r.clientId">
                  <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                          <p class="break-words font-bold leading-snug text-white">{{ r.title }}</p>
                          <p v-if="r.source === 'coach'" class="my-1"><span class="routine-coach-tag">{{ t('routines.byCoach') }}</span></p>
                          <RoutineMeta :routine="r" />
                      </div>
                      <div class="display flex-shrink-0 text-2xl leading-none" :class="routines.progressOf(r).doneToday ? 'text-emerald-400' : 'text-accent'">
                          {{ routines.progressOf(r).total ? `${routines.progressOf(r).done}/${routines.progressOf(r).total}` : routines.progressOf(r).done }}
                      </div>
                  </div>
                  <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="bar(r.clientId)" aria-valuemin="0" aria-valuemax="100">
                      <div class="h-full rounded-full bg-accent transition-all" :style="{ width: Math.max(3, bar(r.clientId)) + '%' }"></div>
                  </div>
                  <p class="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-400">
                      <span v-if="routines.progressOf(r).adherence != null">{{ t('routines.adherence', { pct: routines.progressOf(r).adherence ?? 0 }) }}</span>
                      <span v-if="routines.progressOf(r).streak >= 2" class="routine-streak">{{ tn('routines.streak', routines.progressOf(r).streak) }}</span>
                  </p>
                  <p class="mt-2 truncate text-xs text-slate-300">{{ r.steps.map((s) => s.dose ? `${s.name} (${s.dose})` : s.name).join(' · ') }}</p>
                  <p v-if="r.pending" class="mt-1 font-mono text-[10px] text-slate-500">{{ t('routines.pendingSync') }}</p>
              </button>
          </li>
      </ul>

      <details v-if="ended.length" class="group mt-3">
          <summary class="-mx-1 flex min-h-[2.75rem] cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
              {{ t('routines.ended') }} · {{ ended.length }}
              <svg class="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
          </summary>
          <ul class="space-y-2">
              <li v-for="r in ended" :key="r.clientId">
                  <button type="button" @click="routines.openEdit(r.clientId)" class="w-full rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-left hover:bg-white/5" :data-routine-row="r.clientId">
                      <span class="block truncate text-sm font-bold text-slate-300">{{ r.title }}</span>
                      <RoutineMeta :routine="r" compact />
                  </button>
              </li>
          </ul>
      </details>
  </section>
</template>
