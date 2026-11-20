<script setup lang="ts">
import { defineAsyncComponent, onMounted, reactive, watch, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import ToastStack from '@/components/ToastStack.vue';
import UpdateBanner from '@/components/UpdateBanner.vue';
import RestTimer from '@/components/RestTimer.vue';
import Spinner from '@/components/Spinner.vue';
import AppHeader from '@/components/AppHeader.vue';
import WorkoutView from '@/components/workout/WorkoutView.vue';
import StartPanel from '@/components/workout/StartPanel.vue';
import ExercisePicker from '@/components/workout/ExercisePicker.vue';
import ExerciseCatalog from '@/components/ExerciseCatalog.vue';
import SessionBar from '@/components/SessionBar.vue';
import FinishModal from '@/components/FinishModal.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import TeamIcon from '@/components/TeamIcon.vue';
import { t } from '@/i18n';
import { useGoalsStore } from '@/stores/goals';
import { useRoutinesStore } from '@/stores/routines';
import { usePlannedStore } from '@/stores/planned';
import { useAiStore } from '@/stores/ai';
import { useRemindersStore } from '@/stores/reminders';
import { clearWidget, startWidgetSync } from '@/stores/widget';
import { useHealthStore } from '@/stores/health';
import { useAthleteStore } from '@/stores/athlete';
const athlete = useAthleteStore();
import { appearance } from '@/lib/theme';

// Seltener gebrauchte Teile als eigene Chunks (kleineres Start-Bundle; offline per Service-Worker-Cache verfügbar):
// Auswertungen inkl. Chart.js, Plan, Satz-Dialog mit Animationen, Einstellungen, Editoren.
const DataView = defineAsyncComponent(() => import('@/components/data/DataView.vue'));
// Anmeldung: braucht nur, wer abgemeldet ist - angemeldete Nutzer laden den Code nie
const AuthView = defineAsyncComponent({ loader: () => import('@/components/AuthView.vue'), loadingComponent: Spinner, delay: 150 });
const PlanView = defineAsyncComponent(() => import('@/components/PlanView.vue'));
const SetModal = defineAsyncComponent(() => import('@/components/SetModal.vue'));
const CustomExerciseModal = defineAsyncComponent(() => import('@/components/CustomExerciseModal.vue'));
const SettingsModal = defineAsyncComponent(() => import('@/components/SettingsModal.vue'));
const ProgramEditor = defineAsyncComponent(() => import('@/components/ProgramEditor.vue'));
const MatchModal = defineAsyncComponent(() => import('@/components/MatchModal.vue'));
const TeamModal = defineAsyncComponent(() => import('@/components/TeamModal.vue'));
const RecoveryCodesModal = defineAsyncComponent(() => import('@/components/RecoveryCodesModal.vue'));
const ExerciseInfoSheet = defineAsyncComponent(() => import('@/components/ExerciseInfoSheet.vue'));
const GoalSheet = defineAsyncComponent(() => import('@/components/GoalSheet.vue'));
const RoutineSheet = defineAsyncComponent(() => import('@/components/RoutineSheet.vue'));
const RoutineDetailSheet = defineAsyncComponent(() => import('@/components/RoutineDetailSheet.vue'));
const RoutineLibrarySheet = defineAsyncComponent(() => import('@/components/RoutineLibrarySheet.vue'));
const RoutinePlayer = defineAsyncComponent(() => import('@/components/RoutinePlayer.vue'));
const FitnessTestSheet = defineAsyncComponent(() => import('@/components/athlete/FitnessTestSheet.vue'));
const TestDayPlayer = defineAsyncComponent(() => import('@/components/athlete/testday/TestDayPlayer.vue'));
const PlannedSheet = defineAsyncComponent(() => import('@/components/PlannedSheet.vue'));
const HoldTimer = defineAsyncComponent(() => import('@/components/workout/HoldTimer.vue'));
const PlanBuilderSheet = defineAsyncComponent(() => import('@/components/PlanBuilderSheet.vue'));
const WorkoutSummarySheet = defineAsyncComponent(() => import('@/components/WorkoutSummarySheet.vue'));
const AiCoachSheet = defineAsyncComponent(() => import('@/components/AiCoachSheet.vue'));
const AthleteProfileSheet = defineAsyncComponent(() => import('@/components/AthleteProfileSheet.vue'));
const CoachMemorySheet = defineAsyncComponent(() => import('@/components/CoachMemorySheet.vue'));
// Saison-Deko nur im Halloween-Theme laden
const HalloweenDecor = defineAsyncComponent(() => import('@/components/decor/HalloweenDecor.vue'));
const StrikerDecor = defineAsyncComponent(() => import('@/components/decor/StrikerDecor.vue'));

const app = useAppStore();
const goals = useGoalsStore();
const routines = useRoutinesStore();
const planned = usePlannedStore();
const aiStore = useAiStore();
const { booting, isAuthenticated, tab, authMode, sessionActive } = storeToRefs(app);

/** Dialog-Chunks erst beim ersten Öffnen laden - danach bleiben sie gemountet (Schließen-Animation bleibt erhalten). */
const used = reactive({ set: false, custom: false, settings: false, editor: false, match: false, team: false, codes: false, info: false, goal: false, routine: false, routineDetail: false, library: false, player: false, tests: false, testDay: false, planned: false, hold: false, builder: false, summary: false, ai: false, profile: false, memory: false });
watchEffect(() => {
  if (app.setModal.open) used.set = true;
  if (app.customModal.open) used.custom = true;
  if (app.settingsOpen) used.settings = true;
  if (app.programEditor.open) used.editor = true;
  if (app.matchModal.open) used.match = true;
  if (app.teamModal.open) used.team = true;
  if (app.recoveryCodes) used.codes = true;
  if (app.exerciseInfo) used.info = true;
  if (goals.draft.open) used.goal = true;
  if (routines.editor.open) used.routine = true;
  if (routines.detailId) used.routineDetail = true;
  if (routines.libraryOpen) used.library = true;
  if (routines.playerId) used.player = true;
  if (athlete.testSheet.open) used.tests = true;
  if (athlete.testDayOpen) used.testDay = true;
  if (planned.editor.open) used.planned = true;
  if (app.holdTimer) used.hold = true;
  if (app.planBuilder.open) used.builder = true;
  if (app.summary) used.summary = true;
  if (aiStore.open) used.ai = true;
  if (aiStore.profileOpen) used.profile = true;
  if (aiStore.memoryOpen) used.memory = true;
});

onMounted(() => { void app.init(); });

// Erinnerungen: nach der Anmeldung planen, beim Abmelden löschen (enthalten Namen der Routinen)
const reminders = useRemindersStore();
// iPhone-Widget: Schnappschuss der nächsten Tage aktuell halten bzw. leeren
watch(isAuthenticated, (signedIn) => {
  if (signedIn) { void reminders.start(); startWidgetSync(); void useHealthStore().start(); } else { void reminders.clear(); void clearWidget(); }
}, { immediate: true });
// Mitteilung angetippt: Startbildschirm zeigen (Routinen, Einheit des Tages, Wochenbericht liegen dort)
watch(() => reminders.focus, (f) => {
  if (!f || sessionActive.value) return;
  // Check-in: direkt die Eingabe öffnen (liegt im Plan-Tab)
  if (f.kind === 'checkIn') { tab.value = 'Plan'; app.openCheckIn(); return; }
  if (tab.value !== 'Gym' && tab.value !== 'Football') tab.value = 'Gym';
});

</script>

<template>
  <div class="relative mx-auto w-full px-4 pt-4 sm:px-8 sm:pt-8" :class="isAuthenticated ? 'max-w-3xl pb-40' : 'max-w-5xl pb-8'">
    <div class="bg-orb-1"></div>
    <div class="bg-orb-2"></div>
    <HalloweenDecor v-if="appearance.theme === 'halloween'" />
    <StrikerDecor v-else-if="appearance.theme === 'striker'" />

    <ToastStack />
    <UpdateBanner />
    <RestTimer />

    <Spinner v-if="booting" class="py-40" />
    <AuthView v-else-if="!isAuthenticated || authMode === 'reset'" />

    <template v-else>
      <AppHeader />

      <!-- Kein animierter Tabwechsel: Transform/Opacity über den ganzen Katalog brachte Safari auf dem iPhone zum Absturz.
           Halle/Feld teilen sich den Bereich und bleiben gemountet (nur Inhalte wechseln). -->
      <section v-if="tab === 'Gym' || tab === 'Football'">
        <!-- Läuft eine Einheit: Blöcke mit Sätzen. Sonst: Einstieg + Katalog zum Stöbern. -->
        <WorkoutView v-if="sessionActive" />
        <template v-else>
          <StartPanel />
          <!-- Feld: Spiel und Mannschaftstraining ohne Sätze erfassen (zählen über Minuten × sRPE in die Last) -->
          <div v-if="tab === 'Football'" class="mb-6 grid grid-cols-2 gap-3">
            <button type="button" @click="app.openMatchModal()" data-test="log-match"
                    class="glass-panel flex flex-col items-start rounded-2xl px-4 py-4 text-left transition-colors hover:border-accent/60">
              <span class="display text-lg leading-tight text-white">{{ t('match.log') }}</span>
              <span class="mt-1 font-mono text-[10px] text-slate-400">{{ t('match.infoShort') }}</span>
            </button>
            <button type="button" @click="app.openTeamModal()" data-test="log-team"
                    class="glass-panel relative flex flex-col items-start rounded-2xl px-4 py-4 text-left transition-colors hover:border-accent/60"
                    :class="app.todayPlan?.team && !app.teamLoggedToday ? 'border-accent/60' : ''">
              <span class="display flex items-center gap-1.5 text-lg leading-tight text-white"><TeamIcon class="h-5 w-5 flex-shrink-0 text-accent" />{{ t('team.log') }}</span>
              <span class="mt-1 font-mono text-[10px]" :class="app.todayPlan?.team && !app.teamLoggedToday ? 'font-bold text-accent' : 'text-slate-400'">
                {{ app.todayPlan?.team ? (app.teamLoggedToday ? t('team.loggedToday') : t('team.today')) : t('team.infoShort') }}
              </span>
            </button>
          </div>
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
      <TeamModal v-if="used.team" />
      <ExerciseInfoSheet v-if="used.info" />
      <GoalSheet v-if="used.goal" />
      <RoutineDetailSheet v-if="used.routineDetail" />
      <RoutineLibrarySheet v-if="used.library" />
      <RoutinePlayer v-if="used.player" />
      <FitnessTestSheet v-if="used.tests" />
      <TestDayPlayer v-if="used.testDay" />
      <PlannedSheet v-if="used.planned" />
      <RoutineSheet v-if="used.routine" />
      <HoldTimer v-if="used.hold" />
      <PlanBuilderSheet v-if="used.builder" />
      <WorkoutSummarySheet v-if="used.summary" />
      <AiCoachSheet v-if="used.ai" />
      <AthleteProfileSheet v-if="used.profile" />
      <CoachMemorySheet v-if="used.memory" />
    </template>

    <RecoveryCodesModal v-if="used.codes" />
    <ConfirmDialog />
  </div>
</template>
