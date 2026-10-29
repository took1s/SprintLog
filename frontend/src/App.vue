<script setup lang="ts">
import { defineAsyncComponent, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import ToastStack from '@/components/ToastStack.vue';
import UpdateBanner from '@/components/UpdateBanner.vue';
import RestTimer from '@/components/RestTimer.vue';
import Spinner from '@/components/Spinner.vue';
import AuthView from '@/components/AuthView.vue';
import AppHeader from '@/components/AppHeader.vue';
import PlanChecklist from '@/components/PlanChecklist.vue';
import ExerciseCatalog from '@/components/ExerciseCatalog.vue';
import PlanView from '@/components/PlanView.vue';
import SessionBar from '@/components/SessionBar.vue';
import SessionReview from '@/components/SessionReview.vue';
import SetModal from '@/components/SetModal.vue';
import CustomExerciseModal from '@/components/CustomExerciseModal.vue';
import SettingsModal from '@/components/SettingsModal.vue';
import ProgramEditor from '@/components/ProgramEditor.vue';
import FinishModal from '@/components/FinishModal.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import RecoveryCodesModal from '@/components/RecoveryCodesModal.vue';

// Auswertungen inkl. Chart.js erst laden, wenn DATA geöffnet wird (kleineres Start-Bundle; offline per Precache verfügbar).
const DataView = defineAsyncComponent(() => import('@/components/data/DataView.vue'));

const app = useAppStore();
const { booting, isAuthenticated, tab, authMode } = storeToRefs(app);

onMounted(() => { void app.init(); });
</script>

<template>
  <div class="relative mx-auto w-full max-w-3xl px-4 pb-40 pt-4 sm:px-8 sm:pt-8">
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
        <PlanChecklist />
        <ExerciseCatalog />
      </section>
      <PlanView v-else-if="tab === 'Plan'" />
      <DataView v-else-if="tab === 'Data'" />

      <SessionBar />
      <SessionReview />
      <SetModal />
      <CustomExerciseModal />
      <SettingsModal />
      <ProgramEditor />
      <FinishModal />
    </template>

    <RecoveryCodesModal />
    <ConfirmDialog />
  </div>
</template>
