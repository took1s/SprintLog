<script setup lang="ts">
// Zeile mit Wisch-Geste nach links (wie in iOS-Listen): zeigt "Löschen"; weit genug gewischt = sofort löschen.
// Vertikales Scrollen bleibt frei (touch-action: pan-y), die Geste startet erst bei klar horizontaler Bewegung.
import { computed, ref } from 'vue';
import { t } from '@/i18n';

const props = defineProps<{ label?: string }>();
const emit = defineEmits<{ (e: 'delete'): void; (e: 'tap'): void }>();

const ACTION = 88;          // Breite der Löschen-Fläche
const FULL_SWIPE = 0.55;    // Anteil der Zeilenbreite für "sofort löschen"

const root = ref<HTMLElement | null>(null);
const offset = ref(0);
const dragging = ref(false);
const open = ref(false);
let startX = 0;
let startY = 0;
let base = 0;
let decided: 'h' | 'v' | null = null;
let moved = false;

const style = computed(() => ({ transform: `translate3d(${offset.value}px,0,0)` }));
const actionLabel = computed(() => props.label ?? t('common.delete'));

function down(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  startX = e.clientX;
  startY = e.clientY;
  base = offset.value;
  decided = null;
  moved = false;
}

function move(e: PointerEvent) {
  if (startX === 0 && startY === 0) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (!decided) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    decided = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    if (decided === 'h') { dragging.value = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }
  }
  if (decided !== 'h') return;
  moved = true;
  const width = root.value?.offsetWidth ?? 320;
  offset.value = Math.min(0, Math.max(-width, base + dx));
}

function up() {
  if (startX === 0 && startY === 0) return;
  startX = 0;
  startY = 0;
  if (decided !== 'h') { decided = null; return; }
  dragging.value = false;
  const width = root.value?.offsetWidth ?? 320;
  if (-offset.value > width * FULL_SWIPE) { remove(); return; }
  open.value = -offset.value > ACTION / 2;
  offset.value = open.value ? -ACTION : 0;
}

function close() { open.value = false; offset.value = 0; }

function remove() {
  const width = root.value?.offsetWidth ?? 320;
  offset.value = -width;
  setTimeout(() => { emit('delete'); open.value = false; offset.value = 0; }, 160);
}

function click() {
  if (moved) { moved = false; return; }
  if (open.value) { close(); return; }
  emit('tap');
}
</script>

<template>
  <div ref="root" class="relative overflow-hidden rounded-lg">
      <!-- Löschen-Fläche hinter der Zeile -->
      <button type="button" tabindex="-1" @click="remove" class="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 pr-5 text-[11px] font-black uppercase text-bg tracking-label"
              :style="{ width: Math.max(ACTION, -offset) + 'px' }" :aria-hidden="!open" data-test="swipe-delete">
          {{ actionLabel }}
      </button>
      <div class="swipe-row relative bg-surface" :class="dragging ? '' : 'transition-transform duration-200 ease-out'" :style="style"
           @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @click="click">
          <slot :open="open" :close="close" />
      </div>
  </div>
</template>
