<script setup lang="ts">
// Animierte Übungsfigur: zeichnet das SVG aus lib/figure.ts per requestAnimationFrame neu.
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { MOTIONS, renderFigureSvg } from '@/lib/figure';

const props = withDefaults(defineProps<{ motion: string | null; paused?: boolean }>(), { paused: false });

const host = useTemplateRef<HTMLDivElement>('host');
let start = 0;
let frame = 0;
const reduced = typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

function draw(phase: number) {
  // Das SVG stammt ausschließlich aus eigenem Code (keine Nutzereingaben) - innerHTML ist hier sicher.
  if (host.value) host.value.innerHTML = renderFigureSvg(props.motion, phase);
}

function loop(t: number) {
  const m = props.motion ? MOTIONS[props.motion] : undefined;
  if (!props.paused && m) draw((t - start) / m.duration);
  frame = requestAnimationFrame(loop);
}

onMounted(() => {
  start = performance.now();
  draw(reduced ? 0.5 : 0);
  if (!reduced) frame = requestAnimationFrame(loop);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));
watch(() => props.motion, () => { start = performance.now(); draw(0); });
</script>

<template>
  <div ref="host" class="fx-wrap"></div>
</template>
