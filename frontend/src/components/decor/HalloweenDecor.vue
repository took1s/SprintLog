<script setup lang="ts">
// Saison-Deko "Halloween": Spinnweben in den oberen Ecken, Nebel am unteren Rand (dunkel), einmal pro Sitzung
// ein kleiner Fledermaus-Schwarm. Rein dekorativ: liegt hinter dem Inhalt, fängt keine Tipps ab, aria-hidden,
// und bleibt bei "Bewegung reduzieren" still. Farben nur über Tokens (Masken + currentColor).
import { onBeforeUnmount, onMounted, ref } from 'vue';

const bats = ref(false);
let timer = 0;

onMounted(() => {
  let seen = false;
  try {
    seen = sessionStorage.getItem('sprintlog:bats') === '1';
    sessionStorage.setItem('sprintlog:bats', '1');
  } catch { /* privat: dann eben jedes Mal */ }
  if (seen || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  timer = window.setTimeout(() => { bats.value = true; }, 1400);
});
onBeforeUnmount(() => window.clearTimeout(timer));
</script>

<template>
  <div class="hw-decor" aria-hidden="true" data-test="halloween-decor">
      <span class="hw-web hw-web-left"></span>
      <span class="hw-web hw-web-right"></span>
      <span class="hw-fog"></span>
      <div v-if="bats" class="hw-bats" @animationend.self="bats = false">
          <svg v-for="n in 3" :key="n" class="hw-bat" viewBox="0 0 64 28">
              <path fill="currentColor" d="M32 9l1.5-3 1 4c3.5-2 9.5-6 17.5-6 4 2 8 5 12 9-4-1-7 0-9 3-3-2-6-2-9 1-3-2-6-1-8 2-2-2-4-1-5 2l-1 2-1-2c-1-3-3-4-5-2-2-3-5-4-8-2-3-3-6-3-9-1-2-3-5-4-9-3 4-4 8-7 12-9 8 0 14 4 17.5 6l1-4z"/>
          </svg>
      </div>
  </div>
</template>
