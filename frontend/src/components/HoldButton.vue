<script setup lang="ts">
// Gedrückt halten zum Bestätigen (Einheit verwerfen, Chat löschen): schneller als eine Rückfrage, aber nicht aus Versehen.
// Die Füllung zeigt den Fortschritt; zu früh losgelassen = kurzer Hinweis "Gedrückt halten".
// Tastatur und Screenreader (Klick ohne Zeigerdruck) bekommen die gewohnte Rückfrage über "fallback".
import { computed, onBeforeUnmount, ref } from 'vue';
import { t } from '@/i18n';
import { tap } from '@/lib/native';
import { swallowNextClick } from '@/lib/gestures';

const props = withDefaults(defineProps<{ label: string; variant?: 'text' | 'icon'; duration?: number }>(), { variant: 'text', duration: 700 });
const emit = defineEmits<{ confirm: []; fallback: [] }>();

const holding = ref(false);
const hint = ref(false);
let timer = 0;
let hintTimer = 0;
let done = false;
let pressed = false;

// Als Variable: auch bei "Bewegung reduzieren" läuft der Fortschritt sichtbar mit (app.css)
const fill = computed(() => ({ '--hold-ms': holding.value ? `${props.duration}ms` : '220ms' }));

function down(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  pressed = true;
  done = false;
  holding.value = true;
  hint.value = false;
  window.clearTimeout(hintTimer);
  timer = window.setTimeout(() => {
    timer = 0;
    done = true;
    holding.value = false;
    tap();
    // Der Knopf verschwindet meist mit der Aktion - der Klick beim Loslassen darf nichts darunter treffen
    swallowNextClick();
    emit('confirm');
  }, props.duration);
}

function up() {
  if (!timer) return;
  window.clearTimeout(timer);
  timer = 0;
  holding.value = false;
  // Zu kurz: Hinweis statt Aktion
  hint.value = true;
  hintTimer = window.setTimeout(() => { hint.value = false; }, 1600);
}

// Der Klick folgt im selben Task auf pointerup - danach gilt der Druck als vorbei (auch wenn kein Klick kommt)
function release() {
  window.setTimeout(() => { pressed = false; }, 0);
  up();
}

function click() {
  // Zeiger-Klicks erledigen down/up. Ein Klick ohne vorheriges Drücken kommt von Tastatur oder Screenreader -> Rückfrage
  if (pressed) { pressed = false; return; }
  if (!done) emit('fallback');
}

onBeforeUnmount(() => { window.clearTimeout(timer); window.clearTimeout(hintTimer); });
</script>

<template>
  <button type="button" class="hold-btn relative select-none overflow-hidden" :class="[variant === 'icon' ? 'hold-icon' : 'hold-text', { 'is-holding': holding }]"
          :aria-label="label" data-test="hold-button"
          @pointerdown="down" @pointerup="release" @pointercancel="release" @pointerleave="release" @click="click" @contextmenu.prevent>
      <template v-if="variant === 'icon'">
          <!-- Ring füllt sich um das Symbol -->
          <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 44 44" aria-hidden="true">
              <rect x="1.5" y="1.5" width="41" height="41" rx="11" fill="none" stroke="currentColor" stroke-width="2.5" pathLength="100"
                    class="hold-ring text-red-400" :style="fill" />
          </svg>
          <slot />
      </template>
      <template v-else>
          <span class="hold-fill pointer-events-none absolute inset-0 origin-left bg-red-500/15" :style="fill" aria-hidden="true"></span>
          <!-- Kräftige Linie unten: die Tönung allein hat zu wenig Kontrast -->
          <span class="hold-fill pointer-events-none absolute inset-x-0 bottom-0 h-[3px] origin-left bg-red-500" :style="fill" aria-hidden="true"></span>
          <span class="relative">{{ hint ? t('gesture.holdHint') : label }}</span>
      </template>
  </button>
</template>
