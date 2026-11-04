<script setup lang="ts">
// Coach-Empfehlung für heute: was (trainieren / locker / Pause / Spiel / Reha) und warum.
// Die Gründe sind kurz und nachprüfbar - der Coach rät, er entscheidet nicht.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import type { Reason, TodayKind } from '@/lib/coach';

const app = useAppStore();
const { activeProgram, coach } = storeToRefs(app);
const { openPlanBuilder } = app;

// Nur Paletten-Farben aus tailwind.config.cjs (sky/blue gibt es dort nicht - die Klassen würden leer bleiben).
// Spiel = Gold wie im Wochenplan, locker = Warnfarbe, Pause = neutral.
const tone: Record<TodayKind, { dot: string; text: string }> = {
  train: { dot: 'bg-accent', text: 'text-accent' },
  light: { dot: 'bg-orange-400', text: 'text-orange-300' },
  rest: { dot: 'bg-slate-400', text: 'text-white' },
  match: { dot: 'bg-yellow-400', text: 'text-yellow-300' },
  rehab: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
};

function reasonText(r: Reason): string {
  switch (r.key) {
    case 'readinessLow':
    case 'readinessGood': return t(`coach.reasons.${r.key}`, { value: r.value });
    case 'notRecovered': return t('coach.reasons.notRecovered', { region: t(`recovery.regions.${r.region}`), percent: r.percent });
    case 'longBreak': return t('coach.reasons.longBreak', { days: r.days });
    case 'planNext': return t('coach.reasons.planNext', { day: r.day });
    default: return t(`coach.reasons.${r.key}`);
  }
}

const reasons = computed(() => coach.value.reasons.map(reasonText));
</script>

<template>
  <section class="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4" :data-coach="coach.kind" data-test="coach-card" aria-labelledby="coach-card-title">
      <div class="flex items-center gap-2">
          <span class="h-2 w-2 flex-shrink-0 rounded-full" :class="tone[coach.kind].dot" aria-hidden="true"></span>
          <span class="text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('coach.title') }}</span>
      </div>
      <h3 id="coach-card-title" class="display mt-1.5 break-words text-xl leading-tight" :class="tone[coach.kind].text">{{ t(`coach.kinds.${coach.kind}.title`) }}</h3>
      <p class="mt-1 text-sm leading-snug text-slate-200">{{ t(`coach.kinds.${coach.kind}.text`) }}</p>
      <ul v-if="reasons.length" class="mt-3 flex flex-wrap gap-1.5" :aria-label="t('coach.why')">
          <li v-for="r in reasons" :key="r" class="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] leading-tight text-slate-300">{{ r }}</li>
      </ul>
      <template v-if="!activeProgram">
          <p class="mt-3 text-xs leading-relaxed text-slate-400">{{ t('coach.noPlan') }}</p>
          <button type="button" @click="openPlanBuilder()" class="btn-secondary mt-3 w-full rounded-xl py-3 text-sm" data-test="coach-build">{{ t('coach.buildPlan') }}</button>
      </template>
  </section>
</template>
