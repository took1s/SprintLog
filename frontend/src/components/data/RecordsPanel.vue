<script setup lang="ts">
import { t, tn } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { storeToRefs } from 'pinia';
import { useAppStore, recordHeadline } from '@/stores/app';
import { formatDate, formatNumber } from '@/lib/format';

const app = useAppStore();
const { recordList } = storeToRefs(app);
const { openProgress } = app;
</script>

<template>
  <div class="space-y-3">
      <p v-if="recordList.some((r) => r.gym)" class="px-1 text-[11px] leading-snug text-slate-400">{{ t('records.perGym') }}</p>
      <button v-for="r in recordList" :key="r.key + (r.gym ?? '')" @click="openProgress(r.key)" class="glass-panel flex w-full items-center justify-between rounded-2xl p-4 text-left transition-all hover:border-accent/40">
          <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate font-bold text-white">{{ exerciseName(r.exerciseId, r.name) }}</span>
                  <span v-if="r.gym" class="ex-tag flex-shrink-0" data-test="record-gym">{{ r.gym }}</span>
              </div>
              <div class="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-500">
                  <span>{{ tn('units.sessions', r.sessions) }}</span>
                  <span v-if="r.maxE1RM && !r.isAssisted">{{ t('records.e1rm', { value: formatNumber(r.maxE1RM.value) }) }}</span>
                  <span v-if="r.isAssisted">{{ t('workout.assisted') }}</span>
                  <span v-if="r.trackingType === 'Cardio' && r.maxPower">{{ formatNumber(r.maxPower.value, 0) }} {{ t('units.w') }}</span>
                  <span v-if="r.trackingType === 'Cardio' && r.maxDistance">{{ formatNumber(r.maxDistance.value / 1000, 2) }} {{ t('units.km') }}</span>
                  <span v-if="r.maxVolume">{{ t('records.bestSet', { value: formatNumber(r.maxVolume.value, 0) }) }}</span>
                  <span v-if="r.maxDistance && r.trackingType === 'DistanceTime'">{{ t('records.maxDistance', { value: formatNumber(r.maxDistance.value) }) }}</span>
              </div>
          </div>
          <div class="ml-3 text-right">
              <div class="font-mono text-sm font-black text-yellow-400">{{ recordHeadline(r) }}</div>
              <div class="font-mono text-[10px] text-slate-500">{{ formatDate((r.minAssist || r.maxWeight || r.topSpeed || r.longest || r.maxDistance || {}).date || r.lastDate, { day: '2-digit', month: 'short', year: '2-digit' }) }}</div>
          </div>
      </button>
  </div>
</template>
