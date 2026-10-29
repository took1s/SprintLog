<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { online, syncState, syncing, tab } = storeToRefs(app);
const { openSettings } = app;
</script>

<template>
  <header class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
          <span class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest"
                :class="{
                  'border-red-500/40 bg-red-500/10 text-red-400': syncState.tone === 'red',
                  'border-orange-400/40 bg-orange-400/10 text-orange-300': syncState.tone === 'orange',
                  'border-accent/40 bg-accent/10 text-accent': syncState.tone === 'blue',
                  'border-emerald-400/30 bg-emerald-400/10 text-emerald-400': syncState.tone === 'green'
                }" :title="online ? t('sync.connected') : t('sync.disconnected')">
              <span class="h-1.5 w-1.5 rounded-full bg-current" :class="{ 'animate-pulse': syncing || !online }"></span>
              {{ syncState.label }}
          </span>
      </div>
      <h1 class="text-3xl font-black tracking-tighter text-white sm:text-4xl">Sprint<span class="text-accent">Log</span></h1>
      <button @click="openSettings" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white" :aria-label="t('nav.settings')">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      </button>
  </header>

  <nav class="mb-8 flex justify-center">
      <div class="tab-container w-full max-w-md shadow-xl" role="tablist">
          <button role="tab" :aria-selected="tab === 'Gym'" @click="tab = 'Gym'" class="tab-btn" :class="{ 'tab-active': tab === 'Gym' }">{{ t('nav.gym') }}</button>
          <button role="tab" :aria-selected="tab === 'Football'" @click="tab = 'Football'" class="tab-btn" :class="{ 'tab-active': tab === 'Football' }">{{ t('nav.field') }}</button>
          <button role="tab" :aria-selected="tab === 'Plan'" @click="tab = 'Plan'" class="tab-btn" :class="{ 'tab-active': tab === 'Plan' }">{{ t('nav.plan') }}</button>
          <button role="tab" :aria-selected="tab === 'Data'" @click="tab = 'Data'" class="tab-btn" :class="{ 'tab-active': tab === 'Data' }">{{ t('nav.data') }}</button>
      </div>
  </nav>
</template>
