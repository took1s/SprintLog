<script setup lang="ts">
// Laufende Einheitsdauer als eigene Mini-Komponente: der Sekundentakt rendert nur diese Zeile neu,
// nicht die ganze Übungsliste.
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { formatClock } from '@/lib/format';

const { sessionElapsed } = storeToRefs(useAppStore());
</script>

<template><span>{{ formatClock(sessionElapsed) }}</span></template>
