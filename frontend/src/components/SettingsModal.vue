<script setup lang="ts">
import { t, tn, locale, setLocale, SUPPORTED_LOCALES, LOCALE_NAMES } from '@/i18n';

const TOGGLES = ['autoTimer', 'sound', 'vibration', 'wakeLock', 'showTechnique'] as const;
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import AccountSecurity from '@/components/AccountSecurity.vue';
import { formatDate } from '@/lib/format';

const app = useAppStore();
const { deleteAccount, online, pendingCount, profile, settings, settingsOpen, syncing, user } = storeToRefs(app);
const { confirmDeleteAccount, exportData, logout, syncNow } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="settingsOpen" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="settingsOpen = false">
          <div class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[2rem] p-6 sm:rounded-[2rem] sm:p-8" role="dialog" aria-modal="true" :aria-label="t('settings.title')">
              <div class="mb-6 flex items-start justify-between">
                  <div>
                      <h3 class="text-2xl font-black text-white">{{ t('settings.title') }}</h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                          {{ user?.username }}<template v-if="profile"> · {{ t('settings.since', { date: formatDate(profile.createdAt, { month: 'short', year: 'numeric' }) }) }} · {{ tn('units.workouts', profile.workoutCount) }}</template>
                      </p>
                  </div>
                  <button @click="settingsOpen = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <h4 class="label-xs mb-3 text-accent">{{ t('common.language') }}</h4>
              <div class="mb-6 grid grid-cols-3 gap-2" role="radiogroup" :aria-label="t('common.language')">
                  <button v-for="code in SUPPORTED_LOCALES" :key="code" type="button" role="radio" :aria-checked="locale === code" @click="setLocale(code)"
                          class="chip" :class="locale === code ? 'chip-active' : 'chip-idle'" :lang="code">{{ LOCALE_NAMES[code] }}</button>
              </div>

              <h4 class="label-xs mb-3 text-accent">{{ t('settings.restTimer') }}</h4>
              <div class="mb-3 grid grid-cols-2 gap-3">
                  <label class="rounded-xl border border-white/5 bg-black/20 p-3">
                      <span class="stat-label">{{ t('settings.gymSeconds') }}</span>
                      <input v-model.number="settings.restGym" type="number" min="10" max="900" step="5" class="mt-1 w-full bg-transparent font-mono text-xl font-black text-white outline-none">
                  </label>
                  <label class="rounded-xl border border-white/5 bg-black/20 p-3">
                      <span class="stat-label">{{ t('settings.fieldSeconds') }}</span>
                      <input v-model.number="settings.restField" type="number" min="10" max="900" step="5" class="mt-1 w-full bg-transparent font-mono text-xl font-black text-white outline-none">
                  </label>
              </div>
              <div class="mb-6 space-y-2">
                  <label v-for="key in TOGGLES" :key="key"
                         class="flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-black/20 p-3">
                      <span class="text-sm text-slate-200">{{ t(`settings.toggles.${key}`) }}</span>
                      <input v-model="settings[key]" type="checkbox" class="h-5 w-5 accent-[#00c3ff]">
                  </label>
              </div>

              <h4 class="label-xs mb-3 text-accent">{{ t('settings.data') }}</h4>
              <div class="mb-3 grid grid-cols-2 gap-3">
                  <button @click="exportData('csv')" class="cyber-outline-btn rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest">{{ t('settings.exportCsv') }}</button>
                  <button @click="exportData('json')" class="cyber-outline-btn rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest">{{ t('settings.exportJson') }}</button>
              </div>
              <button @click="syncNow()" :disabled="!online || syncing || !pendingCount" class="cyber-outline-btn mb-6 w-full rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
                  {{ syncing ? t('settings.syncing') : pendingCount ? tn('settings.syncNow', pendingCount) : t('settings.allSynced') }}
              </button>

              <AccountSecurity />

              <h4 class="label-xs mb-3 text-accent">{{ t('settings.account') }}</h4>
              <button @click="logout" class="mb-3 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-white">{{ t('settings.logout') }}</button>

              <div class="rounded-2xl border border-red-500/20 p-4">
                  <button v-if="!deleteAccount.open" @click="deleteAccount.open = true" class="w-full text-[10px] font-bold uppercase tracking-widest text-red-400">{{ t('settings.deleteAccount') }}</button>
                  <form v-else @submit.prevent="confirmDeleteAccount">
                      <p class="mb-3 text-xs text-slate-300">{{ t('settings.deleteInfo') }}</p>
                      <input v-model="deleteAccount.password" type="password" autocomplete="current-password" :placeholder="t('settings.confirmPassword')" class="cyber-input mb-2 w-full rounded-xl p-3 text-sm">
                      <p v-if="deleteAccount.error" class="mb-2 font-mono text-[10px] text-red-400">{{ deleteAccount.error }}</p>
                      <div class="grid grid-cols-2 gap-2">
                          <button type="button" @click="deleteAccount.open = false" class="rounded-xl bg-white/5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-300">{{ t('common.cancel') }}</button>
                          <button type="submit" :disabled="deleteAccount.busy || !online" class="danger-btn rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-widest">{{ deleteAccount.busy ? '...' : t('settings.deleteForever') }}</button>
                      </div>
                  </form>
              </div>

              <p class="mt-6 text-center font-mono text-[9px] uppercase tracking-widest text-slate-600">{{ t('settings.version') }}</p>
          </div>
      </div>
  </transition>
</template>
