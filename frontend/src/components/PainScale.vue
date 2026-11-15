<script setup lang="ts">
// Schmerz 0-10 mit einem Tipp: Ampel-Farben (0-2 gut, 3-5 Vorsicht, 6+ Warnung), große Trefferflächen, als Radiogruppe.
import { t } from '@/i18n';
import { PAIN_MAX, painTone } from '@/lib/routines';

defineProps<{ modelValue: number | null; label?: string }>();
const emit = defineEmits<{ pick: [level: number] }>();
const levels = Array.from({ length: PAIN_MAX + 1 }, (_, i) => i);
</script>

<template>
  <div class="pain-scale" role="radiogroup" :aria-label="label ?? t('routines.pain.question')" data-test="pain-scale">
      <button v-for="n in levels" :key="n" type="button" role="radio" class="pain-btn" :class="[`is-${painTone(n)}`, { 'is-on': modelValue === n }]"
              :aria-checked="modelValue === n" :aria-label="t('routines.pain.level', { n })" :data-pain="n" @click="emit('pick', n)">{{ n }}</button>
  </div>
</template>
