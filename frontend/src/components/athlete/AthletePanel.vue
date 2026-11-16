<script setup lang="ts">
// Abschnitt "Athlet" im Daten-Tab - nach Häufigkeit sortiert: täglich (Gewicht, Eiweiß), Verlauf, Leistungstests
// (alle 6-8 Wochen), Uhr & Apple Health (einmal einrichten).
import DailyBodyCard from './DailyBodyCard.vue';
import BodyTrendsCard from './BodyTrendsCard.vue';
import FitnessTestsCard from './FitnessTestsCard.vue';
import WatchCard from './WatchCard.vue';
</script>

<template>
  <div class="space-y-4" data-test="athlete-panel">
      <DailyBodyCard />
      <BodyTrendsCard />
      <FitnessTestsCard />
      <WatchCard />
  </div>
</template>
