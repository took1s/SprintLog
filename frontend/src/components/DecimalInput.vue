<script setup lang="ts">
// Zahlenfeld, das Komma UND Punkt akzeptiert (iPhone mit deutscher/russischer Tastatur hat nur das Komma).
// Warum nicht <input type="number">: Safari verwirft "72,5" je nach Sprache als ungültig, und ein gebundener
// Zahlenwert formatiert beim Tippen neu - "72," wurde sofort wieder zu "72", das Komma ließ sich nicht setzen.
// Hier bleibt der getippte Text stehen, solange das Feld aktiv ist; nach außen geht nur die Zahl.
import { computed, ref, watch } from 'vue';
import { intlLocale } from '@/i18n';
import { cleanDecimalInput, parseDecimal } from '@/lib/decimal';

const props = withDefaults(defineProps<{
  modelValue: number | null | undefined;
  /** Nur ganze Zahlen (Wiederholungen, Sekunden). */
  integer?: boolean;
  /** Beim Antippen alles markieren (schnelles Überschreiben im Satz). */
  selectOnFocus?: boolean;
}>(), { integer: false, selectOnFocus: false });
const emit = defineEmits<{ (e: 'update:modelValue', value: number | null): void }>();

const sep = computed(() => (1.5).toLocaleString(intlLocale()).charAt(1));
const format = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '' : String(Math.round(v * 100) / 100).replace('.', sep.value));

const focused = ref(false);
const text = ref(format(props.modelValue));
// Von außen geänderte Werte (z. B. +/- Knopf, neuer Satz) übernehmen - aber nicht mitten im Tippen.
watch(() => props.modelValue, (v) => {
  if (!focused.value || parseDecimal(text.value) !== v) text.value = format(v);
});

function onInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const cleaned = cleanDecimalInput(el.value, props.integer);
  if (cleaned !== el.value) el.value = cleaned;
  text.value = cleaned;
  emit('update:modelValue', parseDecimal(cleaned));
}

function onFocus(e: FocusEvent) {
  focused.value = true;
  if (props.selectOnFocus) (e.target as HTMLInputElement).select();
}

function onBlur() {
  focused.value = false;
  text.value = format(props.modelValue);
}
</script>

<template>
  <input :value="text" type="text" :inputmode="integer ? 'numeric' : 'decimal'" autocomplete="off" enterkeyhint="done"
         @input="onInput" @focus="onFocus" @blur="onBlur">
</template>
