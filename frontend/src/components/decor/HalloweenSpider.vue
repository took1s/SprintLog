<script setup lang="ts">
// Kleine Spinne am Faden (Halloween-Deko auf der Startkarte): wippt kurz, zwei Augen in Akzentfarbe.
// Bewegt werden nur HTML-Elemente per transform (läuft auf dem Compositor) - Animationen an SVG-Teilen
// lösten in jedem Bild Layout und Neuzeichnen der ganzen Karte aus.
</script>

<template>
  <span class="hw-spider" aria-hidden="true">
      <span class="hw-spider-thread"></span>
      <svg class="hw-spider-body" viewBox="0 26 28 22">
          <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
              <path d="M11 33c-3-2-6-2-9 1M11 35c-3 0-6 1-8 4M11 37c-3 1-5 3-6 6M12 38c-2 2-3 5-3 8"/>
              <path d="M17 33c3-2 6-2 9 1M17 35c3 0 6 1 8 4M17 37c3 1 5 3 6 6M16 38c2 2 3 5 3 8"/>
          </g>
          <ellipse cx="14" cy="31" rx="3.6" ry="3.2" fill="currentColor" />
          <ellipse cx="14" cy="38.5" rx="5" ry="5.8" fill="currentColor" />
          <circle class="hw-spider-eye" cx="12.6" cy="30.8" r="0.9" />
          <circle class="hw-spider-eye" cx="15.4" cy="30.8" r="0.9" />
      </svg>
  </span>
</template>
