<script setup lang="ts">
// Symbol je Gedächtnis-Thema (Strich-Icons, Farbe kommt vom Elternteil über currentColor).
import type { MemoryCategory } from '@/stores/ai';

defineProps<{ category: MemoryCategory | 'brain' }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <!-- Pflaster -->
      <g v-if="category === 'injury'"><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/></g>
      <path v-else-if="category === 'health'" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>
      <g v-else-if="category === 'goal'"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6"/></g>
      <g v-else-if="category === 'schedule'"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></g>
      <path v-else-if="category === 'preference'" d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4 7.2 18.9l.9-5.4L4.2 9.7l5.4-.8z"/>
      <path v-else-if="category === 'equipment'" d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>
      <path v-else-if="category === 'insight'" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>
      <!-- Gedächtnis (Knopf im Chat) -->
      <path v-else-if="category === 'brain'" d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V6a2 2 0 0 0-3-2zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>
      <circle v-else cx="12" cy="12" r="3"/>
  </svg>
</template>
