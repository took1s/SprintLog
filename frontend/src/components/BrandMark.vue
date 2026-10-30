<script setup lang="ts">
// Markenzeichen: "S" als Laufbahn - wie das App-Icon, aber in den Farben des aktiven Themes.
</script>

<template>
  <span class="flex flex-shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent" aria-hidden="true">
    <!-- Klein ohne Ball: bei 32 px würde er mit dem S-Ende verschmelzen -->
    <svg viewBox="200 140 624 744" class="h-[70%] w-[70%]" fill="none">
      <path d="M700 330 C 690 250 610 210 515 210 C 405 210 330 270 330 352 C 330 440 410 470 512 498 C 620 528 705 570 705 668 C 705 760 625 818 512 818 C 410 818 335 780 320 700"
            stroke="currentColor" stroke-width="128" stroke-linecap="round" />
    </svg>
  </span>
</template>
