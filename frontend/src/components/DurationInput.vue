<script setup lang="ts">
// Dauer als "mm:ss" (oder "h:mm:ss"); eine Zahl ohne Doppelpunkt sind Minuten ("20" = 20:00) - so liest man es vom Gerät ab.
// Gespeichert werden Sekunden. Beim Tippen wird nichts umformatiert, erst beim Verlassen des Feldes.
import { ref, watch } from 'vue';
import { formatClock, parseDuration } from '@/lib/format';

const props = defineProps<{ modelValue: number | null | undefined }>();
const emit = defineEmits<{ 'update:modelValue': [number | null] }>();

const show = (v: number | null | undefined) => (v != null && v > 0 ? formatClock(v) : '');
const text = ref(show(props.modelValue));
let editing = false;
watch(() => props.modelValue, (v) => { if (!editing) text.value = show(v); });

function onInput(e: Event) {
  editing = true;
  text.value = (e.target as HTMLInputElement).value.replace(/[^\d:.,]/g, '');
  const seconds = parseDuration(text.value);
  if (seconds !== null) emit('update:modelValue', seconds);
}
function onBlur() {
  editing = false;
  text.value = show(parseDuration(text.value) ?? props.modelValue);
}
function onFocus(e: FocusEvent) {
  (e.target as HTMLInputElement).select();
}
</script>

<template>
  <input :value="text" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="0:00"
         @input="onInput" @blur="onBlur" @focus="onFocus" />
</template>
