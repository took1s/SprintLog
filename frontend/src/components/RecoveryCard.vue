<script setup lang="ts">
// Erholung je Bereich (Beine, Oberkörper, Rumpf, Nervensystem) aus den letzten Einheiten - eine Schätzung.
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { formatDate, formatTime } from '@/lib/format';

const app = useAppStore();
const { clockDate, recovery } = storeToRefs(app);

/** Nur zeigen, wenn noch etwas nicht ganz erholt ist. */
const open = computed(() => recovery.value.filter((r) => r.percent < 100));
const allReady = computed(() => open.value.length === 0);

function readyText(d: Date): string {
  const now = clockDate.value;
  const sameDay = d.toDateString() === now.toDateString();
  const time = formatTime(d.toISOString());
  return sameDay ? t('recovery.readyToday', { time }) : t('recovery.readyAt', { day: formatDate(d.toISOString(), { weekday: 'short' }), time });
}

/** Eingeklappt: eine Zeile (niedrigster Wert); aufklappen für alle Bereiche. */
const expanded = ref(false);
const lowest = computed(() => [...recovery.value].sort((a, b) => a.percent - b.percent)[0] ?? null);

const barClass = (p: number) => (p >= 85 ? 'bg-emerald-400' : p >= 55 ? 'bg-yellow-400' : 'bg-orange-400');
</script>

<template>
  <div v-if="recovery.length" class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03]" data-test="recovery-card">
      <button type="button" class="flex min-h-[3rem] w-full items-center gap-3 px-4 py-3 text-left" :aria-expanded="expanded" data-test="recovery-toggle" @click="expanded = !expanded">
          <span class="min-w-0 flex-1">
              <span class="block text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('recovery.title') }}</span>
              <span v-if="allReady" class="block text-sm font-bold text-emerald-400">{{ t('recovery.allReady') }}</span>
              <span v-else-if="lowest" class="block truncate text-sm font-bold text-white">{{ t(`recovery.regions.${lowest.region}`) }} · {{ lowest.percent }} %</span>
          </span>
          <span v-if="lowest && !allReady" class="h-1.5 w-16 flex-shrink-0 overflow-hidden rounded-full bg-white/10" aria-hidden="true"><span class="block h-full rounded-full" :class="barClass(lowest.percent)" :style="{ width: Math.max(4, lowest.percent) + '%' }"></span></span>
          <svg class="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200" :class="{ 'rotate-90': expanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
      </button>
      <transition name="expand">
          <div v-if="expanded" class="expand-wrap">
              <div class="px-4 pb-4">
                  <ul class="space-y-2.5">
                      <li v-for="r in recovery" :key="r.region" class="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3">
                          <span class="truncate text-xs font-bold text-slate-200">{{ t(`recovery.regions.${r.region}`) }}</span>
                          <!-- Name für Screenreader: Bereich + Prozent (die Zeitangabe steht daneben als Text) -->
                          <span class="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-label="t(`recovery.regions.${r.region}`)" :aria-valuenow="r.percent" aria-valuemin="0" aria-valuemax="100" :aria-valuetext="`${r.percent} %`">
                              <span class="block h-full rounded-full transition-all" :class="barClass(r.percent)" :style="{ width: Math.max(4, r.percent) + '%' }"></span>
                          </span>
                          <span class="whitespace-nowrap font-mono text-[11px]" :class="r.percent >= 100 ? 'text-emerald-400' : 'text-slate-300'">{{ r.percent >= 100 ? t('recovery.ready') : readyText(r.readyAt) }}</span>
                      </li>
                  </ul>
                  <p class="mt-3 text-[10px] leading-relaxed text-slate-500">{{ t('recovery.disclaimer') }}</p>
              </div>
          </div>
      </transition>
  </div>
</template>
