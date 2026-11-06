<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore, type DataTab } from '@/stores/app';
import Spinner from '@/components/Spinner.vue';
import OverviewPanel from './OverviewPanel.vue';
import HistoryPanel from './HistoryPanel.vue';
import ProgressPanel from './ProgressPanel.vue';
import RecordsPanel from './RecordsPanel.vue';
import CalendarPanel from './CalendarPanel.vue';
import ObsidianModal from './ObsidianModal.vue';
import { computed, defineAsyncComponent, onMounted } from 'vue';
import { useAiStore } from '@/stores/ai';
const AiAnalysisPanel = defineAsyncComponent(() => import('./AiAnalysisPanel.vue'));

const app = useAppStore();
const { dataTab, loadingHistory, allWorkouts, tab } = storeToRefs(app);

const ai = useAiStore();
onMounted(() => { if (!ai.status) void ai.loadStatus(); });
// Der KI-Tab erscheint nur, wenn der Server einen API-Key hat
const TABS = computed<DataTab[]>(() => (ai.enabled ? ['overview', 'ai', 'history', 'progress', 'records', 'calendar'] : ['overview', 'history', 'progress', 'records', 'calendar']));
</script>

<template>
  <section>
    <div class="mb-8 flex justify-start gap-4 overflow-x-auto border-b border-white/10 pb-1 sm:justify-center sm:gap-6">
      <button v-for="tab_ in TABS" :key="tab_" @click="dataTab = tab_" class="subtab" :class="{ 'subtab-active': dataTab === tab_ }" :data-subtab="tab_">{{ t(`data.tabs.${tab_}`) }}</button>
    </div>

    <AiAnalysisPanel v-if="dataTab === 'ai' && ai.enabled" />

    <Spinner v-else-if="loadingHistory" />

    <div v-else-if="!allWorkouts.length" class="glass-panel rounded-2xl px-6 py-12 text-center">
      <p class="font-mono text-sm uppercase tracking-widest text-slate-400">{{ t('data.empty') }}</p>
      <p class="mt-2 text-xs text-slate-500">{{ t('data.emptyInfo') }}</p>
      <button @click="tab = 'Gym'" class="cyber-btn mt-6 rounded-xl px-5 py-3 text-xs font-bold">{{ t('data.startTraining') }}</button>
    </div>

    <template v-else>
      <OverviewPanel v-if="dataTab === 'overview'" />
      <HistoryPanel v-else-if="dataTab === 'history'" />
      <ProgressPanel v-else-if="dataTab === 'progress'" />
      <RecordsPanel v-else-if="dataTab === 'records'" />
      <CalendarPanel v-else-if="dataTab === 'calendar'" />
    </template>
    <ObsidianModal />
  </section>
</template>
