<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { updateWorker } = storeToRefs(app);
const { applyUpdate } = app;
</script>

<template>
  <transition name="slide-up">
      <div v-if="updateWorker" class="glass-panel fixed bottom-44 left-1/2 z-[70] flex w-[92%] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-accent/40 p-3">
          <span class="text-xs font-bold text-white">{{ t('update.available') }}</span>
          <button @click="applyUpdate" class="cyber-btn rounded-xl px-3 py-2 text-[10px] font-bold">{{ t('update.reload') }}</button>
      </div>
  </transition>
</template>
