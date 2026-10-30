<script setup lang="ts">
import { t, tn, locale, setLocale, SUPPORTED_LOCALES, LOCALE_NAMES } from '@/i18n';

const TOGGLES = ['autoTimer', 'sound', 'vibration', 'wakeLock', 'showTechnique', 'useRir'] as const;
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import AccountSecurity from '@/components/AccountSecurity.vue';
import { formatDate } from '@/lib/format';
import { appearance, activeScheme, setScheme, setTheme, SCHEMES, THEMES, THEME_SWATCHES } from '@/lib/theme';

const app = useAppStore();
const { deleteAccount, online, pendingCount, profile, settings, settingsOpen, syncing, user } = storeToRefs(app);
const { confirmDeleteAccount, exportData, logout, syncNow } = app;
</script>

<template>
  <transition name="fade">
      <div v-if="settingsOpen" class="fixed inset-0 z-40 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="settingsOpen = false">
          <div class="glass-panel modal-panel max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl sm:p-8" role="dialog" aria-modal="true" :aria-label="t('settings.title')">
              <div class="mb-6 flex items-start justify-between">
                  <div>
                      <h3 class="display text-2xl text-white">{{ t('settings.title') }}</h3>
                      <p class="mt-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                          {{ user?.username }}<template v-if="profile"> · {{ t('settings.since', { date: formatDate(profile.createdAt, { month: 'short', year: 'numeric' }) }) }} · {{ tn('units.workouts', profile.workoutCount) }}</template>
                      </p>
                  </div>
                  <button @click="settingsOpen = false" class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <h4 class="label-xs mb-3 text-accent">{{ t('appearance.title') }}</h4>
              <div class="mb-3 grid grid-cols-2 gap-2" role="radiogroup" :aria-label="t('appearance.theme')">
                  <button v-for="name in THEMES" :key="name" type="button" role="radio" :aria-checked="appearance.theme === name" @click="setTheme(name)" :data-theme-option="name"
                          class="rounded-2xl border-2 p-2 text-left transition-colors" :class="appearance.theme === name ? 'border-accent' : 'border-white/10 hover:border-white/20'">
                      <!-- Miniatur in den echten Farben des Themes (aktuelles Schema) -->
                      <span class="flex h-14 items-end gap-1.5 rounded-xl p-2" :style="{ background: THEME_SWATCHES[name][activeScheme][0] }" aria-hidden="true">
                          <span class="h-8 flex-1 rounded-md" :style="{ background: THEME_SWATCHES[name][activeScheme][1] }"></span>
                          <span class="h-8 w-8 rounded-md" :style="{ background: THEME_SWATCHES[name][activeScheme][2] }"></span>
                      </span>
                      <span class="mt-2 block px-1 text-sm font-bold text-white">{{ t(`appearance.themes.${name}.name`) }}</span>
                      <span class="block px-1 pb-1 text-[11px] leading-tight text-slate-400">{{ t(`appearance.themes.${name}.description`) }}</span>
                  </button>
              </div>
              <div class="mb-6 flex gap-1 rounded-xl bg-white/5 p-1" role="radiogroup" :aria-label="t('appearance.scheme')">
                  <button v-for="scheme in SCHEMES" :key="scheme" type="button" role="radio" :aria-checked="appearance.scheme === scheme" @click="setScheme(scheme)"
                          class="flex-1 rounded-lg py-2 text-xs font-bold transition-colors" :class="appearance.scheme === scheme ? 'bg-surface text-white shadow-sm' : 'text-slate-400'">{{ t(`appearance.schemes.${scheme}`) }}</button>
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
                      <input v-model="settings[key]" type="checkbox" class="h-5 w-5">
                  </label>
              </div>

              <h4 class="label-xs mb-3 text-accent">{{ t('settings.data') }}</h4>
              <div class="mb-3 grid grid-cols-2 gap-3">
                  <button @click="exportData('csv')" class="cyber-outline-btn rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest">{{ t('settings.exportCsv') }}</button>
                  <button @click="exportData('json')" class="cyber-outline-btn rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest">{{ t('settings.exportJson') }}</button>
              </div>
              <button @click="syncNow()" :disabled="syncing || !pendingCount" class="cyber-outline-btn mb-6 w-full rounded-xl py-3 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">
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
