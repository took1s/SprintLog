<script setup lang="ts">
import { defineAsyncComponent, onMounted, reactive, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import ToastStack from '@/components/ToastStack.vue';
import UpdateBanner from '@/components/UpdateBanner.vue';
import RestTimer from '@/components/RestTimer.vue';
import Spinner from '@/components/Spinner.vue';
import AuthView from '@/components/AuthView.vue';
import AppHeader from '@/components/AppHeader.vue';
import WorkoutView from '@/components/workout/WorkoutView.vue';
import StartPanel from '@/components/workout/StartPanel.vue';
import ExercisePicker from '@/components/workout/ExercisePicker.vue';
import ExerciseCatalog from '@/components/ExerciseCatalog.vue';
import SessionBar from '@/components/SessionBar.vue';
import FinishModal from '@/components/FinishModal.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import { t } from '@/i18n';

// Seltener gebrauchte Teile als eigene Chunks (kleineres Start-Bundle; offline per Service-Worker-Cache verfügbar):
// Auswertungen inkl. Chart.js, Plan, Satz-Dialog mit Animationen, Einstellungen, Editoren.
const DataView = defineAsyncComponent(() => import('@/components/data/DataView.vue'));
const PlanView = defineAsyncComponent(() => import('@/components/PlanView.vue'));
const SetModal = defineAsyncComponent(() => import('@/components/SetModal.vue'));
const CustomExerciseModal = defineAsyncComponent(() => import('@/components/CustomExerciseModal.vue'));
const SettingsModal = defineAsyncComponent(() => import('@/components/SettingsModal.vue'));
const ProgramEditor = defineAsyncComponent(() => import('@/components/ProgramEditor.vue'));
const MatchModal = defineAsyncComponent(() => import('@/components/MatchModal.vue'));
const RecoveryCodesModal = defineAsyncComponent(() => import('@/components/RecoveryCodesModal.vue'));

const app = useAppStore();
const { booting, isAuthenticated, tab, authMode, sessionActive } = storeToRefs(app);

/** Dialog-Chunks erst beim ersten Öffnen laden - danach bleiben sie gemountet (Schließen-Animation bleibt erhalten). */
const used = reactive({ set: false, custom: false, settings: false, editor: false, match: false, codes: false });
watchEffect(() => {
  if (app.setModal.open) used.set = true;
  if (app.customModal.open) used.custom = true;
  if (app.settingsOpen) used.settings = true;
  if (app.programEditor.open) used.editor = true;
  if (app.matchModal.open) used.match = true;
  if (app.recoveryCodes) used.codes = true;
});

onMounted(() => { void app.init(); });
</script>

<template>
  <div class="relative mx-auto w-full px-4 pt-4 sm:px-8 sm:pt-8" :class="isAuthenticated ? 'max-w-3xl pb-40' : 'max-w-5xl pb-8'">
    <div class="bg-orb-1"></div>
    <div class="bg-orb-2"></div>

    <ToastStack />
    <UpdateBanner />
    <RestTimer />

    <Spinner v-if="booting" class="py-40" />
    <AuthView v-else-if="!isAuthenticated || authMode === 'reset'" />

    <template v-else>
      <AppHeader />

      <section v-if="tab === 'Gym' || tab === 'Football'">
        <!-- Läuft eine Einheit: Blöcke mit Sätzen. Sonst: Einstieg + Katalog zum Stöbern. -->
        <WorkoutView v-if="sessionActive" />
        <template v-else>
          <StartPanel />
          <button v-if="tab === 'Football'" type="button" @click="app.openMatchModal()" data-test="log-match"
                  class="glass-panel mb-6 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left transition-colors hover:border-accent/60">
            <span class="display text-lg text-white">{{ t('match.log') }}</span>
            <span class="font-mono text-[10px] text-slate-400">{{ t('match.info') }}</span>
          </button>
          <h2 class="label-xs mb-3">{{ t('catalog.title') }}</h2>
          <ExerciseCatalog />
        </template>
      </section>
      <PlanView v-else-if="tab === 'Plan'" :class="{ 'pb-28': app.sessionActive }" />
      <DataView v-else-if="tab === 'Data'" />

      <SessionBar />
      <ExercisePicker />
      <SetModal v-if="used.set" />
      <CustomExerciseModal v-if="used.custom" />
      <SettingsModal v-if="used.settings" />
      <ProgramEditor v-if="used.editor" />
      <FinishModal />
      <MatchModal v-if="used.match" />
    </template>

    <RecoveryCodesModal v-if="used.codes" />
    <ConfirmDialog />
  </div>
</template>
