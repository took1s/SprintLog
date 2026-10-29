<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { toastClass } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { toasts } = storeToRefs(ui);
</script>

<template>
  <div class="pointer-events-none fixed left-1/2 top-4 z-[120] flex w-[92%] max-w-sm -translate-x-1/2 flex-col gap-2" aria-live="polite">
      <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="glass-panel pointer-events-auto rounded-2xl border px-4 py-3 text-xs font-bold tracking-wide" :class="toastClass(t.tone)">
              {{ t.message }}
          </div>
      </transition-group>
  </div>
</template>
