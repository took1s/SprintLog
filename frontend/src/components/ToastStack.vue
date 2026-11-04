<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { toastClass } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { toasts } = storeToRefs(ui);
const { runAction } = ui;
</script>

<template>
  <div class="pointer-events-none fixed left-1/2 top-4 z-[120] flex w-[92%] max-w-sm -translate-x-1/2 flex-col gap-2" aria-live="polite">
      <transition-group name="toast">
          <div v-for="t in toasts" :key="t.id" class="glass-panel pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-bold tracking-wide" :class="toastClass(t.tone)" role="status">
              <span class="min-w-0 flex-1">{{ t.message }}</span>
              <!-- Aktion (z. B. Rückgängig) -->
              <button v-if="t.action" type="button" @click="runAction(t.id)" class="-my-2 -mr-2 flex min-h-[2.75rem] flex-shrink-0 items-center rounded-xl px-3 text-[11px] font-black uppercase text-accent tracking-label hover:bg-white/5" data-test="toast-action">
                  {{ t.action.label }}
              </button>
          </div>
      </transition-group>
  </div>
</template>
