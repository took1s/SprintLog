<script setup lang="ts">
// Erholung je Bereich (Beine, Oberkörper, Rumpf, Nervensystem) aus den letzten Einheiten - eine Schätzung.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { formatDate } from '@/lib/format';

const app = useAppStore();
const { clockDate, recovery } = storeToRefs(app);

/** Nur zeigen, wenn noch etwas nicht ganz erholt ist. */
const open = computed(() => recovery.value.filter((r) => r.percent < 100));
const allReady = computed(() => open.value.length === 0);

function readyText(d: Date): string {
  const now = clockDate.value;
  const sameDay = d.toDateString() === now.toDateString();
  const time = formatDate(d.toISOString(), { hour: '2-digit', minute: '2-digit' });
  return sameDay ? t('recovery.readyToday', { time }) : t('recovery.readyAt', { day: formatDate(d.toISOString(), { weekday: 'short' }), time });
}

const barClass = (p: number) => (p >= 85 ? 'bg-emerald-400' : p >= 55 ? 'bg-yellow-400' : 'bg-orange-400');
</script>

<template>
  <div v-if="recovery.length" class="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-test="recovery-card">
      <div class="mb-3 flex items-center justify-between gap-2">
          <span class="text-[10px] font-bold uppercase text-slate-400 tracking-label">{{ t('recovery.title') }}</span>
          <span v-if="allReady" class="text-[11px] font-bold text-emerald-400">{{ t('recovery.allReady') }}</span>
      </div>
      <ul class="space-y-2.5">
          <li v-for="r in recovery" :key="r.region" class="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3">
              <span class="truncate text-xs font-bold text-slate-200">{{ t(`recovery.regions.${r.region}`) }}</span>
              <span class="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="r.percent" aria-valuemin="0" aria-valuemax="100">
                  <span class="block h-full rounded-full transition-all" :class="barClass(r.percent)" :style="{ width: Math.max(4, r.percent) + '%' }"></span>
              </span>
              <span class="font-mono text-[10px]" :class="r.percent >= 100 ? 'text-emerald-400' : 'text-slate-400'">{{ r.percent >= 100 ? t('recovery.ready') : readyText(r.readyAt) }}</span>
          </li>
      </ul>
      <p class="mt-3 text-[10px] leading-relaxed text-slate-500">{{ t('recovery.disclaimer') }}</p>
  </div>
</template>
