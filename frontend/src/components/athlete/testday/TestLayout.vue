<script setup lang="ts">
// Aufbau auf dem Platz als kleine Skizze: Linien, Hütchen, Abstände und Laufweg.
import { t } from '@/i18n';
import type { BlockId } from '@/lib/testDay';

defineProps<{ block: BlockId }>();
</script>

<template>
  <svg v-if="block !== 'cmj'" viewBox="0 0 320 84" class="td-layout h-auto w-full" role="img" :aria-label="t('testDay.layout')">
      <!-- Sprint: Start 0,5 m hinter der Linie, Zeit bei 10 m und 30 m -->
      <template v-if="block === 'sprint'">
          <line x1="22" y1="44" x2="300" y2="44" class="tl-path" />
          <circle cx="14" cy="44" r="5" class="tl-runner" />
          <g v-for="[x, label] in ([[24, '0'], [113, '10 m'], [292, '30 m']] as [number, string][])" :key="label">
              <line :x1="x" y1="18" :x2="x" y2="64" class="tl-line" />
              <path :d="`M${x - 5} 70 l5 -9 l5 9 z`" class="tl-cone" />
              <text :x="x" y="12" text-anchor="middle" class="tl-label">{{ label }}</text>
          </g>
          <text x="14" y="82" text-anchor="middle" class="tl-small">−0,5 m</text>
      </template>
      <!-- 5-10-5: Start Mitte, 5 m zur Seite, 10 m zur anderen, 5 m zurück durch die Mitte -->
      <template v-else-if="block === 'agility'">
          <g v-for="[x, label] in ([[70, '5 m'], [160, t('testDay.layoutStart')], [250, '5 m']] as [number, string][])" :key="x">
              <line :x1="x" y1="18" :x2="x" y2="70" class="tl-line" />
              <path :d="`M${x - 5} 78 l5 -9 l5 9 z`" class="tl-cone" />
              <text :x="x" y="12" text-anchor="middle" class="tl-label">{{ label }}</text>
          </g>
          <path d="M160 32 H76 M76 44 H244 M244 56 H160" class="tl-path is-run" />
          <circle cx="160" cy="32" r="5" class="tl-runner" />
      </template>
      <!-- Yo-Yo IR1: 20 m Pendel, 5 m Erholungszone hinter dem Start -->
      <template v-else-if="block === 'yoyo'">
          <rect x="10" y="20" width="50" height="44" class="tl-zone" />
          <text x="35" y="78" text-anchor="middle" class="tl-small">5 m</text>
          <g v-for="[x, label] in ([[60, t('testDay.layoutStart')], [300, '20 m']] as [number, string][])" :key="x">
              <line :x1="x" y1="18" :x2="x" y2="66" class="tl-line" />
              <path :d="`M${x - 5} 74 l5 -9 l5 9 z`" class="tl-cone" />
              <text :x="x" y="12" text-anchor="middle" class="tl-label">{{ label }}</text>
          </g>
          <path d="M66 36 H294 M294 48 H66" class="tl-path is-run" />
          <circle cx="66" cy="36" r="5" class="tl-runner" />
      </template>
      <!-- 30-15 IFT: 40 m, Linien bei 0/20/40 m, je 3-m-Zone davor -->
      <template v-else-if="block === 'ift'">
          <rect x="12" y="20" width="22" height="44" class="tl-zone" />
          <rect x="149" y="20" width="22" height="44" class="tl-zone" />
          <rect x="286" y="20" width="22" height="44" class="tl-zone" />
          <g v-for="[x, label] in ([[12, '0'], [160, '20 m'], [308, '40 m']] as [number, string][])" :key="x">
              <line :x1="x" y1="18" :x2="x" y2="66" class="tl-line" />
              <text :x="x" y="12" text-anchor="middle" class="tl-label">{{ label }}</text>
          </g>
          <path d="M20 42 H300" class="tl-path is-run" />
          <text x="160" y="80" text-anchor="middle" class="tl-small">± 3 m</text>
      </template>
  </svg>
</template>
