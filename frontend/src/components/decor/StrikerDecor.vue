<script setup lang="ts">
// Theme "Neon Striker": Speedlines aus der oberen Ecke, Mittelkreis des Spielfelds am unteren Rand und einmal pro
// Sitzung ein Schuss (Ball mit Lichtspur) quer über den Kopfbereich. Eigene Gestaltung, rein dekorativ: hinter dem
// Inhalt, ohne Klickfläche, aria-hidden, bei "Bewegung reduzieren" ohne Schuss. Farben nur über Tokens.
import { onBeforeUnmount, onMounted, ref } from 'vue';

const shot = ref(false);
let timer = 0;

onMounted(() => {
  let seen = false;
  try {
    seen = sessionStorage.getItem('sprintlog:shot') === '1';
    sessionStorage.setItem('sprintlog:shot', '1');
  } catch { /* privat: dann eben jedes Mal */ }
  if (seen || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  timer = window.setTimeout(() => { shot.value = true; }, 900);
});
onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <div class="st-decor" aria-hidden="true" data-test="striker-decor">
      <span class="st-speed"></span>
      <span class="st-pitch"></span>
      <div v-if="shot" class="st-shot" @animationend.self="shot = false">
          <span class="st-trail"></span>
          <svg class="st-ball" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="currentColor" />
              <path class="st-ball-panel" d="M12 7.2l3.6 2.6-1.4 4.3h-4.4L8.4 9.8zM12 2.2v5M21.4 9.4l-5.8.4M18 20l-3.8-5.9M6 20l3.8-5.9M2.6 9.4l5.8.4" />
          </svg>
      </div>
  </div>
</template>
