<script setup lang="ts">
// Abschnitt "Athlet" im Daten-Tab: Leistungstests und Körper/Ernährung/Apple Health.
import FitnessTestsCard from './FitnessTestsCard.vue';
import BodyCard from './BodyCard.vue';
</script>

<template>
  <div class="space-y-4" data-test="athlete-panel">
      <FitnessTestsCard />
      <BodyCard />
  </div>
</template>
