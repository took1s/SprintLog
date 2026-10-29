<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { dialog } = storeToRefs(ui);
const { resolveDialog } = ui;
</script>

<template>
  <transition name="fade">
      <div v-if="dialog.open" class="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm" @click.self="resolveDialog(false)">
          <div class="glass-panel modal-panel w-full max-w-sm rounded-[2rem] border border-accent/20 p-6 text-center" role="alertdialog" aria-modal="true" :aria-label="dialog.title">
              <h3 class="mb-2 text-xl font-black uppercase tracking-widest text-white">{{ dialog.title }}</h3>
              <p class="mb-8 text-sm text-slate-400">{{ dialog.message }}</p>
              <div class="grid grid-cols-2 gap-3">
                  <button @click="resolveDialog(false)" class="rounded-xl bg-white/5 py-3 font-bold text-slate-300 transition-all hover:bg-white/10">{{ t('common.cancel') }}</button>
                  <button @click="resolveDialog(true)" class="rounded-xl py-3 font-bold" :class="dialog.danger ? 'danger-btn' : 'cyber-btn'">{{ dialog.confirmText }}</button>
              </div>
          </div>
      </div>
  </transition>
</template>
