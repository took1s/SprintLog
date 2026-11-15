<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore, type DataTab } from '@/stores/app';
import Spinner from '@/components/Spinner.vue';
import OverviewPanel from './OverviewPanel.vue';
import ObsidianModal from './ObsidianModal.vue';
import DataTabs from './DataTabs.vue';
import { computed, defineAsyncComponent, onMounted, ref, useTemplateRef } from 'vue';
import { useSwipeNav } from '@/lib/scrub';
import { useAiStore } from '@/stores/ai';
const AiAnalysisPanel = defineAsyncComponent(() => import('./AiAnalysisPanel.vue'));
// Abschnitte erst laden, wenn sie gebraucht werden (kleinerer Start); kurz nach dem Öffnen im Leerlauf vorladen,
// damit der Wechsel trotzdem ohne Wartezeit ist.
const loaders = {
  history: () => import('./HistoryPanel.vue'),
  progress: () => import('./ProgressPanel.vue'),
  records: () => import('./RecordsPanel.vue'),
  calendar: () => import('./CalendarPanel.vue'),
  athlete: () => import('@/components/athlete/AthletePanel.vue'),
};
const HistoryPanel = defineAsyncComponent(loaders.history);
const ProgressPanel = defineAsyncComponent(loaders.progress);
const RecordsPanel = defineAsyncComponent(loaders.records);
const CalendarPanel = defineAsyncComponent(loaders.calendar);
const AthletePanel = defineAsyncComponent(loaders.athlete);

const app = useAppStore();
const { dataTab, loadingHistory, allWorkouts, tab } = storeToRefs(app);

const ai = useAiStore();
onMounted(() => {
  if (!ai.status) void ai.loadStatus();
  window.setTimeout(() => { for (const load of Object.values(loaders)) void load().catch(() => undefined); }, 1200);
});
// Der KI-Tab erscheint nur, wenn der Server einen API-Key hat
const TABS = computed<DataTab[]>(() => (ai.enabled ? ['overview', 'athlete', 'ai', 'history', 'progress', 'records', 'calendar'] : ['overview', 'athlete', 'history', 'progress', 'records', 'calendar']));

// Richtung des Wechsels für den kurzen Übergang (weiter = von rechts)
const direction = ref<1 | -1>(1);
const tabsBar = useTemplateRef<InstanceType<typeof DataTabs>>('tabsBar');
function go(next: DataTab) {
  if (next === dataTab.value) return;
  direction.value = TABS.value.indexOf(next) >= TABS.value.indexOf(dataTab.value) ? 1 : -1;
  dataTab.value = next;
  tabsBar.value?.revealTop();
}

// Seitlich wischen im Inhalt = nächster/vorheriger Abschnitt
const content = useTemplateRef<HTMLElement>('content');
useSwipeNav(content, (dir) => {
  const i = TABS.value.indexOf(dataTab.value) + dir;
  const next = TABS.value[i];
  if (next) go(next);
});
</script>

<template>
  <section>
    <DataTabs ref="tabsBar" :tabs="TABS" :model-value="dataTab" @update:model-value="go" />

    <!-- Wischen wechselt den Abschnitt; der kurze Übergang zeigt die Richtung -->
    <div ref="content" class="swipe-nav" data-test="data-content">
      <Transition :name="direction > 0 ? 'dnext' : 'dprev'" mode="out-in">
        <div :key="dataTab">
          <AiAnalysisPanel v-if="dataTab === 'ai' && ai.enabled" />
          <!-- Athlet: Tests und Körperwerte gehen auch ohne erfasste Einheiten -->
          <AthletePanel v-else-if="dataTab === 'athlete'" />

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
        </div>
      </Transition>
    </div>
    <ObsidianModal />
  </section>
</template>
