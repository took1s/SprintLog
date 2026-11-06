<script setup lang="ts">
// Kleine Spinne am Faden (Halloween-Deko auf der Startkarte): wippt langsam, zwei Augen in Akzentfarbe.
</script>

<template>
  <svg class="hw-spider" viewBox="0 0 28 56" aria-hidden="true">
      <line class="hw-spider-thread" x1="14" y1="0" x2="14" y2="26" stroke="currentColor" stroke-width="1" />
      <g class="hw-spider-body">
          <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
              <path d="M11 33c-3-2-6-2-9 1M11 35c-3 0-6 1-8 4M11 37c-3 1-5 3-6 6M12 38c-2 2-3 5-3 8"/>
              <path d="M17 33c3-2 6-2 9 1M17 35c3 0 6 1 8 4M17 37c3 1 5 3 6 6M16 38c2 2 3 5 3 8"/>
          </g>
          <ellipse cx="14" cy="31" rx="3.6" ry="3.2" fill="currentColor" />
          <ellipse cx="14" cy="38.5" rx="5" ry="5.8" fill="currentColor" />
          <circle class="hw-spider-eye" cx="12.6" cy="30.8" r="0.9" />
          <circle class="hw-spider-eye" cx="15.4" cy="30.8" r="0.9" />
      </g>
  </svg>
</template>
