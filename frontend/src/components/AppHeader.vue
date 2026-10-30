<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { online, pendingCount, syncState, syncing, tab } = storeToRefs(app);
const { openSettings, syncNow } = app;
</script>

<template>
  <header class="mb-6 flex items-center justify-between gap-3">
      <h1 class="flex min-w-0 items-center gap-2">
          <span class="display flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-base text-on-accent" aria-hidden="true">S</span>
          <span class="display truncate text-xl text-white">SprintLog</span>
      </h1>
      <div class="flex flex-shrink-0 items-center gap-2">
          <!-- Offene Einheiten: Antippen sendet sofort (statt nur zu informieren). -->
          <component :is="pendingCount ? 'button' : 'span'" :type="pendingCount ? 'button' : undefined"
                @click="pendingCount && !syncing ? syncNow() : undefined"
                class="flex min-h-[2.75rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-label"
                :class="{
                  'border-red-500/40 bg-red-500/10 text-red-400': syncState.tone === 'red',
                  'border-orange-400/40 bg-orange-400/10 text-orange-300': syncState.tone === 'orange',
                  'border-accent/40 bg-accent/10 text-accent': syncState.tone === 'blue',
                  'border-emerald-400/30 bg-emerald-400/10 text-emerald-400': syncState.tone === 'green'
                }" :title="pendingCount ? t('sync.tapToSync') : online ? t('sync.connected') : t('sync.disconnected')"
                :aria-label="pendingCount ? `${syncState.label} - ${t('sync.tapToSync')}` : undefined">
              <span class="h-1.5 w-1.5 rounded-full bg-current" :class="{ 'animate-pulse': syncing || !online }"></span>
              <!-- Alles synchron: nur der Punkt (Platz für die Marke); Text bei offen/offline/Fehler -->
              <span :class="syncState.tone === 'green' ? 'sr-only sm:not-sr-only' : ''">{{ syncState.label }}</span>
          </component>
          <button @click="openSettings" class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white" :aria-label="t('nav.settings')">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      </button>
      </div>
  </header>

  <nav class="mb-8 flex justify-center">
      <div class="tab-container w-full max-w-md" role="tablist">
          <button role="tab" :aria-selected="tab === 'Gym'" @click="tab = 'Gym'" class="tab-btn" :class="{ 'tab-active': tab === 'Gym' }">{{ t('nav.gym') }}</button>
          <button role="tab" :aria-selected="tab === 'Football'" @click="tab = 'Football'" class="tab-btn" :class="{ 'tab-active': tab === 'Football' }">{{ t('nav.field') }}</button>
          <button role="tab" :aria-selected="tab === 'Plan'" @click="tab = 'Plan'" class="tab-btn" :class="{ 'tab-active': tab === 'Plan' }">{{ t('nav.plan') }}</button>
          <button role="tab" :aria-selected="tab === 'Data'" @click="tab = 'Data'" class="tab-btn" :class="{ 'tab-active': tab === 'Data' }">{{ t('nav.data') }}</button>
      </div>
  </nav>
</template>
