<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, recordHeadline } from '@/stores/app';
import { formatDate, formatNumber } from '@/lib/format';

const app = useAppStore();
const { recordList } = storeToRefs(app);
const { openProgress } = app;
</script>

<template>
  <div class="space-y-3">
      <button v-for="r in recordList" :key="r.key" @click="openProgress(r.key)" class="glass-panel flex w-full items-center justify-between rounded-2xl p-4 text-left transition-all hover:border-accent/40">
          <div class="min-w-0">
              <div class="truncate font-bold text-white">{{ r.name }}</div>
              <div class="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-slate-500">
                  <span>{{ r.sessions }} sessions</span>
                  <span v-if="r.maxE1RM">e1RM {{ formatNumber(r.maxE1RM.value) }} kg</span>
                  <span v-if="r.maxVolume">best set {{ formatNumber(r.maxVolume.value, 0) }} kg</span>
                  <span v-if="r.maxDistance && r.trackingType === 'DistanceTime'">max {{ formatNumber(r.maxDistance.value) }} m</span>
              </div>
          </div>
          <div class="ml-3 text-right">
              <div class="font-mono text-sm font-black text-yellow-400">{{ recordHeadline(r) }}</div>
              <div class="font-mono text-[10px] text-slate-500">{{ formatDate((r.maxWeight || r.topSpeed || r.longest || r.maxDistance || {}).date || r.lastDate, { day: '2-digit', month: 'short', year: '2-digit' }) }}</div>
          </div>
      </button>
  </div>
</template>
