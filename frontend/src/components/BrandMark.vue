<script setup lang="ts">
// Markenzeichen: kursives Slab-S (Tempo + Kraft) - wie das App-Icon, aber in den Farben des aktiven Themes.
// variant="halloween" ergänzt einen Sichelmond (Saison); Farben nur über Tokens (bg-accent / currentColor).
withDefaults(defineProps<{ variant?: 'default' | 'halloween' }>(), { variant: 'default' });
</script>

<template>
  <span class="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent text-on-accent" aria-hidden="true">
    <!-- Klein ohne Spielfeldlinien: bei 32 px wären sie nur Rauschen. viewBox = S-Box (650 x 640) mit 15 % Rand -->
    <svg viewBox="-490 -425 930 930" class="h-full w-full" fill="none">
      <path d="M230 -200H-40A120 120 0 0 0 -40 40H40A120 120 0 0 1 40 280H-260" transform="skewX(-14)"
            stroke="currentColor" stroke-width="160" />
      <!-- Sichel oben links: liegt innerhalb der Eckenrundung aller Themes (max. r-md 14 px bei 32 px) -->
      <path v-if="variant === 'halloween'" fill="currentColor"
            d="M-229.1 -225.6A75 75 0 1 1 -301.4 -325A61.5 61.5 0 0 0 -229.1 -225.6Z" />
    </svg>
  </span>
</template>
