<script setup lang="ts">
// Ein Schritt (Routine, Coach-Karte, geplante Einheit): Name und Dosis untereinander - beide dürfen umbrechen.
// Nebeneinander hatte die Dosis feste Breite und drückte den Namen bei langen Texten auf einen Buchstaben pro Zeile.
import { t } from '@/i18n';

defineProps<{ name: string; dose?: string | null; index?: number; exerciseId?: number | null; boxed?: boolean }>();
const emit = defineEmits<{ info: [id: number] }>();
</script>

<template>
  <li class="routine-step" :class="{ 'is-boxed': boxed }">
      <span v-if="index != null" class="routine-step-no mt-0.5" aria-hidden="true">{{ index + 1 }}</span>
      <span class="routine-step-text">
          <span class="routine-step-name">{{ name }}</span>
          <span v-if="dose" class="routine-step-dose">{{ dose }}</span>
      </span>
      <button v-if="exerciseId != null" type="button" class="routine-icon-btn !h-9 !w-9" :aria-label="t('routines.showHow', { name })" data-test="routine-step-info" @click="emit('info', exerciseId)">
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
      </button>
  </li>
</template>
