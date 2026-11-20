<script setup lang="ts">
// Gemeinsame Linien-Symbole (24er Raster, Strich 2, Farbe über currentColor aus den Tokens).
// Ein Ort für die Symbole der Navigation und des Coachs - damit überall dieselbe Bildsprache gilt.
import { ICONS, type IconName } from '@/lib/icons';

defineProps<{ name: IconName }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-for="d in ICONS[name]" :key="d" :d="d" />
  </svg>
</template>
