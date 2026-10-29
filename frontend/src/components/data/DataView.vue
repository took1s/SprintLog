<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore, type DataTab } from '@/stores/app';
import Spinner from '@/components/Spinner.vue';
import OverviewPanel from './OverviewPanel.vue';
import HistoryPanel from './HistoryPanel.vue';
import ProgressPanel from './ProgressPanel.vue';
import RecordsPanel from './RecordsPanel.vue';
import CalendarPanel from './CalendarPanel.vue';

const app = useAppStore();
const { dataTab, loadingHistory, allWorkouts, tab } = storeToRefs(app);

const TABS: [DataTab, string][] = [['overview', 'Overview'], ['history', 'History'], ['progress', 'Progress'], ['records', 'Records'], ['calendar', 'Calendar']];
</script>

<template>
  <section>
    <div class="mb-8 flex justify-start gap-4 overflow-x-auto border-b border-white/10 pb-1 sm:justify-center sm:gap-6">
      <button v-for="t in TABS" :key="t[0]" @click="dataTab = t[0]" class="subtab" :class="{ 'subtab-active': dataTab === t[0] }">{{ t[1] }}</button>
    </div>

    <Spinner v-if="loadingHistory" />

    <div v-else-if="!allWorkouts.length" class="glass-panel rounded-2xl px-6 py-12 text-center">
      <p class="font-mono text-sm uppercase tracking-widest text-slate-400">No data yet</p>
      <p class="mt-2 text-xs text-slate-500">Log your first sets in GYM or FIELD and finish the session.</p>
      <button @click="tab = 'Gym'" class="cyber-btn mt-6 rounded-xl px-5 py-3 text-xs font-bold">Start training</button>
    </div>

    <template v-else>
      <OverviewPanel v-if="dataTab === 'overview'" />
      <HistoryPanel v-else-if="dataTab === 'history'" />
      <ProgressPanel v-else-if="dataTab === 'progress'" />
      <RecordsPanel v-else-if="dataTab === 'records'" />
      <CalendarPanel v-else-if="dataTab === 'calendar'" />
    </template>
  </section>
</template>
