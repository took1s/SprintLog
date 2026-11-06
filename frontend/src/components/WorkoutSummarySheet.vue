<script setup lang="ts">
// Direkt nach dem Speichern: ein Satz Motivation, die Eckdaten, die geschätzte Erholung je Bereich und wann es weitergeht.
import { computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { formatDate, formatNumber, formatTime } from '@/lib/format';
import { REGIONS } from '@/lib/recovery';
import { vSheetDrag } from '@/lib/gestures';
import { useTween } from '@/lib/tween';
import { alarmHaptic } from '@/lib/native';

const app = useAppStore();
const { summary, todayPlan } = storeToRefs(app);
const { closeSummary } = app;

const H = 3_600_000;

const rows = computed(() => {
  const s = summary.value;
  if (!s) return [];
  const max = Math.max(1, s.recovery.total);
  return REGIONS.filter((r) => s.recovery.hours[r] > 0)
    .map((r) => ({ region: r, hours: s.recovery.hours[r], width: Math.max(8, (s.recovery.hours[r] / max) * 100) }))
    .sort((x, y) => y.hours - x.hours);
});

const fullyReady = computed(() => {
  const s = summary.value;
  if (!s || s.recovery.total <= 0) return '';
  const at = new Date(new Date(s.at).getTime() + s.recovery.total * H);
  return t('summary.fullyReady', { day: formatDate(at.toISOString(), { weekday: 'long' }), time: formatTime(at.toISOString()) });
});

const next = computed(() => {
  const p = todayPlan.value;
  if (!p) return [];
  const day = (d: Date) => formatDate(d.toISOString(), { weekday: 'long' });
  const out: string[] = [];
  if (p.nextTrainingAfterToday) out.push(t('summary.nextTraining', { day: day(p.nextTrainingAfterToday) }));
  if (p.nextMatch) out.push(t('summary.nextMatch', { day: day(p.nextMatch) }));
  return out;
});

// Geschafft-Moment: Zahlen zählen hoch, Balken wachsen, kurzes haptisches "Erfolg"
const progress = useTween(() => summary.value?.at);
watch(() => summary.value?.at, (at) => { if (at) alarmHaptic(); });
const up = (v: number) => Math.round(v * progress.value);

const stats = computed(() => {
  const s = summary.value;
  if (!s) return [];
  // Einheit getrennt vom Wert: die Zahl darf groß sein, "kg" steht klein daneben und passt auch bei 12 345 noch in die Kachel
  return [
    { label: t('summary.sets'), value: String(up(s.sets)), unit: '' },
    { label: t('summary.volume'), value: s.volume > 0 ? formatNumber(up(s.volume), 0) : '--', unit: s.volume > 0 ? t('units.kg') : '' },
    { label: t('summary.minutes'), value: s.minutes ? String(up(s.minutes)) : '--', unit: '' },
    { label: t('summary.rpe'), value: s.rpe ? String(up(s.rpe)) : '--', unit: '' },
  ];
});
</script>

<template>
  <transition name="sheet">
      <div v-if="summary" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="closeSummary">
          <div v-sheet-drag="closeSummary" class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl" role="dialog" aria-modal="true" :aria-label="t('summary.kicker')" data-test="workout-summary">
              <!-- Haken zeichnet sich, Funken fliegen einmal heraus (dekorativ) -->
              <div class="finish-badge relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/40" aria-hidden="true">
                  <span class="finish-burst"><i v-for="n in 12" :key="n"></i></span>
                  <svg class="h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path class="finish-check" pathLength="1" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('summary.kicker') }}</p>
              <h2 class="display mt-1 break-words text-2xl leading-tight text-white" data-test="summary-line">{{ summary.line }}</h2>

              <dl class="mt-5 grid grid-cols-4 gap-2">
                  <div v-for="s in stats" :key="s.label" class="min-w-0 rounded-xl border border-white/5 bg-black/20 px-1.5 py-3 text-center">
                      <dt class="stat-label truncate">{{ s.label }}</dt>
                      <dd class="mt-1 truncate font-mono text-xl font-black leading-none text-white tabular-nums">{{ s.value }}<span v-if="s.unit" class="ml-0.5 text-[10px] font-bold text-slate-400">{{ s.unit }}</span></dd>
                  </div>
              </dl>

              <section class="mt-5" data-test="summary-recovery">
                  <h3 class="label-xs mb-3">{{ t('summary.recovery') }}</h3>
                  <p v-if="!rows.length" class="text-sm text-slate-300">{{ t('recovery.light') }}</p>
                  <ul v-else class="space-y-2.5">
                      <li v-for="r in rows" :key="r.region" class="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3">
                          <span class="truncate text-xs font-bold text-slate-200">{{ t(`recovery.regions.${r.region}`) }}</span>
                          <span class="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                              <span class="bar-accent bar-grow block h-full rounded-full" :style="{ width: r.width + '%' }"></span>
                          </span>
                          <span class="whitespace-nowrap font-mono text-[11px] text-slate-300">~{{ r.hours }} {{ t('units.h') }}</span>
                      </li>
                  </ul>
                  <p v-if="fullyReady" class="mt-3 text-sm font-bold text-white">{{ fullyReady }}</p>
                  <p v-for="n in next" :key="n" class="mt-1 font-mono text-[11px] text-slate-400">{{ n }}</p>
                  <p class="mt-3 text-[10px] leading-relaxed text-slate-500">{{ t('recovery.disclaimer') }}</p>
              </section>

              <button type="button" @click="closeSummary" class="btn-primary mt-6 w-full rounded-xl py-4 font-bold" data-test="summary-done">{{ t('summary.done') }}</button>
          </div>
      </div>
  </transition>
</template>
