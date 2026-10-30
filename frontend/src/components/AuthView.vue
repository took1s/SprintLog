<script setup lang="ts">
// Anmeldung, Registrierung und Passwort-Wiederherstellung (Code oder E-Mail).
// Vollbild statt Dialog: der erste Eindruck der App. Funktioniert in allen Themes und Sprachen.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { t, locale, setLocale, SUPPORTED_LOCALES } from '@/i18n';
import { activeScheme, appearance, setScheme } from '@/lib/theme';

const app = useAppStore();
const { authBusy, authError, authNotice, authForm, authMode, authOptions, isAuthenticated } = storeToRefs(app);
const { fieldError, submitAuth, setAuthMode } = app;

const FEATURES = ['oneTap', 'insights', 'offline'] as const;
const showPassword = ref(false);
const capsLock = ref(false);
watch(authMode, () => { showPassword.value = false; capsLock.value = false; });

const isLoginOrRegister = computed(() => authMode.value === 'login' || authMode.value === 'register');
const submitLabel = computed(() => t(`auth.submit.${authMode.value}`));

/** Grobe Passwortstärke (Länge zählt am meisten) - nur Orientierung, Regel ist min. 8 Zeichen. */
const strength = computed(() => {
  const pw = authMode.value === 'register' ? authForm.value.password : authForm.value.newPassword;
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[a-zа-яäöü]/.test(pw) && /[A-ZА-ЯÄÖÜ]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\p{L}\p{N}]/u.test(pw)) score++;
  const level = pw.length < 8 ? 0 : score >= 5 ? 3 : score >= 3 ? 2 : 1;
  return { level, label: t(`auth.strength.${(['short', 'weak', 'fair', 'strong'] as const)[level]}`) };
});

function onKey(e: KeyboardEvent) { capsLock.value = e.getModifierState?.('CapsLock') ?? false; }
function toggleScheme() { setScheme(activeScheme.value === 'dark' ? 'light' : 'dark'); }
</script>

<template>
  <div class="relative flex min-h-[100dvh] flex-col">
    <!-- Kopf: Marke, Sprache, Hell/Dunkel -->
    <header class="flex items-center justify-between py-2">
      <div class="flex items-center gap-2.5">
        <span class="display flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg text-on-accent" aria-hidden="true">S</span>
        <span class="display text-xl text-white">SprintLog</span>
      </div>
      <div class="flex items-center gap-1">
        <button v-for="code in SUPPORTED_LOCALES" :key="code" type="button" @click="setLocale(code)" :lang="code" :aria-pressed="locale === code"
                class="h-9 min-w-[2.5rem] rounded-lg px-2 font-mono text-xs font-bold uppercase transition-colors"
                :class="locale === code ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'">{{ code }}</button>
        <button type="button" @click="toggleScheme" class="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                :aria-label="activeScheme === 'dark' ? t('appearance.schemes.light') : t('appearance.schemes.dark')" :data-scheme-toggle="appearance.scheme">
          <svg v-if="activeScheme === 'dark'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        </button>
      </div>
    </header>

    <main class="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 py-8 lg:grid-cols-[1.1fr_1fr]">
      <!-- Botschaft + Spielfeld-Linien als Motiv -->
      <section class="relative">
        <svg class="pointer-events-none absolute -right-2 -top-12 h-48 w-48 text-accent/[0.09] lg:-top-20 lg:h-80 lg:w-80" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="10" y="10" width="180" height="180" rx="6"/><line x1="10" y1="100" x2="190" y2="100"/><circle cx="100" cy="100" r="30"/><circle cx="100" cy="100" r="3" fill="currentColor"/>
          <rect x="60" y="10" width="80" height="34"/><rect x="60" y="156" width="80" height="34"/>
        </svg>
        <transition name="swap" mode="out-in">
          <div :key="authMode" class="relative">
            <p class="text-[11px] font-bold uppercase text-accent tracking-label">{{ t(`auth.subtitle.${authMode}`) }}</p>
            <h1 class="display mt-2 text-4xl text-white sm:text-5xl">{{ t(`auth.hero.${authMode}.title`) }}</h1>
            <p class="mt-3 max-w-md text-base leading-relaxed text-slate-300">{{ t(`auth.hero.${authMode}.text`) }}</p>
          </div>
        </transition>
        <ul v-if="isLoginOrRegister" class="relative mt-6 hidden space-y-3 sm:block">
          <li v-for="n in FEATURES" :key="n" class="flex items-start gap-3 text-sm text-slate-300">
            <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent" aria-hidden="true">
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            </span>
            {{ t(`auth.features.${n}`) }}
          </li>
        </ul>
      </section>

      <!-- Formular -->
      <form @submit.prevent="submitAuth" class="glass-panel modal-panel w-full rounded-3xl p-6 sm:p-8" novalidate>
        <div v-if="isLoginOrRegister" class="mb-6 flex gap-1 rounded-xl bg-white/5 p-1" role="tablist">
          <button type="button" role="tab" :aria-selected="authMode === 'login'" data-test="to-login" @click="setAuthMode('login')"
                  class="flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors" :class="authMode === 'login' ? 'bg-surface text-white shadow-sm' : 'text-slate-400 hover:text-white'">{{ t('auth.tabs.login') }}</button>
          <button type="button" role="tab" :aria-selected="authMode === 'register'" data-test="to-register" @click="setAuthMode('register')"
                  class="flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors" :class="authMode === 'register' ? 'bg-surface text-white shadow-sm' : 'text-slate-400 hover:text-white'">{{ t('auth.tabs.register') }}</button>
        </div>

        <!-- Benutzername -->
        <div v-if="authMode === 'login' || authMode === 'register' || authMode === 'recover'" class="mb-4">
          <label class="mb-1.5 block text-sm font-bold text-slate-200" for="auth-user">{{ t('auth.username') }}</label>
          <input id="auth-user" v-model="authForm.username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" :placeholder="t('auth.usernamePlaceholder')"
                 class="field h-12 w-full rounded-xl px-4" :class="{ 'border-red-500': fieldError('username') }" :aria-invalid="!!fieldError('username')" aria-describedby="auth-user-hint">
          <p id="auth-user-hint" class="mt-1 min-h-[1rem] text-xs" :class="fieldError('username') ? 'text-red-400' : 'text-slate-500'">
            {{ fieldError('username') || (authMode === 'register' ? t('auth.usernameHint') : '') }}
          </p>
        </div>

        <div v-if="authMode === 'forgot'" class="mb-4">
          <label class="mb-1.5 block text-sm font-bold text-slate-200" for="auth-login">{{ t('auth.usernameOrEmail') }}</label>
          <input id="auth-login" v-model="authForm.login" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" :placeholder="t('auth.loginPlaceholder')"
                 class="field h-12 w-full rounded-xl px-4">
        </div>

        <div v-if="authMode === 'recover'" class="mb-4">
          <label class="mb-1.5 block text-sm font-bold text-slate-200" for="auth-code">{{ t('auth.recoveryCode') }}</label>
          <input id="auth-code" v-model="authForm.code" type="text" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX"
                 class="field h-12 w-full rounded-xl px-4 font-mono uppercase tracking-widest" :class="{ 'border-red-500': fieldError('code') }">
          <p class="mt-1 min-h-[1rem] text-xs text-red-400">{{ fieldError('code') }}</p>
        </div>

        <!-- Passwort (Anmelden/Registrieren) bzw. neues Passwort -->
        <div v-if="authMode !== 'forgot'" class="mb-2">
          <div class="mb-1.5 flex items-baseline justify-between">
            <label class="block text-sm font-bold text-slate-200" :for="isLoginOrRegister ? 'auth-pass' : 'auth-new'">{{ isLoginOrRegister ? t('auth.password') : t('auth.newPassword') }}</label>
            <button v-if="authMode === 'login'" type="button" data-test="forgot" @click="setAuthMode(authOptions.emailEnabled ? 'forgot' : 'recover')" class="text-xs font-bold text-accent hover:underline">{{ t('auth.forgot') }}</button>
          </div>
          <div class="relative">
            <input v-if="isLoginOrRegister" id="auth-pass" v-model="authForm.password" :type="showPassword ? 'text' : 'password'" @keyup="onKey" @keydown="onKey"
                   :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" placeholder="••••••••"
                   class="field h-12 w-full rounded-xl pl-4 pr-12" :class="{ 'border-red-500': fieldError('password') }" :aria-invalid="!!fieldError('password')">
            <input v-else id="auth-new" v-model="authForm.newPassword" :type="showPassword ? 'text' : 'password'" @keyup="onKey" @keydown="onKey" autocomplete="new-password" placeholder="••••••••"
                   class="field h-12 w-full rounded-xl pl-4 pr-12" :class="{ 'border-red-500': fieldError('newpassword') }">
            <button type="button" @click="showPassword = !showPassword" class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-white"
                    :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')" :aria-pressed="showPassword">
              <svg v-if="!showPassword" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 004.2-.9"/></svg>
            </button>
          </div>
          <!-- Stärke + Hinweise -->
          <div v-if="authMode !== 'login' && strength" class="mt-2 flex items-center gap-2" aria-live="polite">
            <div class="flex flex-1 gap-1" aria-hidden="true">
              <span v-for="n in 3" :key="n" class="h-1 flex-1 rounded-full transition-colors"
                    :class="n <= strength.level ? (strength.level === 1 ? 'bg-orange-400' : strength.level === 2 ? 'bg-yellow-400' : 'bg-emerald-400') : 'bg-white/10'"></span>
            </div>
            <span class="text-xs font-bold" :class="strength.level <= 1 ? 'text-orange-400' : strength.level === 2 ? 'text-yellow-400' : 'text-emerald-400'">{{ strength.label }}</span>
          </div>
          <p class="mt-1 min-h-[1rem] text-xs" :class="fieldError('password') || fieldError('newpassword') ? 'text-red-400' : capsLock ? 'text-orange-400' : 'text-slate-500'">
            {{ fieldError('password') || fieldError('newpassword') || (capsLock ? t('auth.capsLock') : authMode !== 'login' ? t('auth.minChars') : '') }}
          </p>
        </div>

        <p v-if="authNotice" class="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300" role="status">{{ authNotice }}</p>
        <p v-if="authError" class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400" role="alert">{{ authError }}</p>

        <button type="submit" :disabled="authBusy || (authMode === 'forgot' && !!authNotice)" class="btn-primary mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base">
          <span v-if="authBusy" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true"></span>
          {{ authBusy ? t('common.processing') : submitLabel }}
        </button>

        <!-- Wege zurück / Alternativen -->
        <div v-if="!isLoginOrRegister" class="mt-5 flex flex-col items-center gap-2 text-sm">
          <button v-if="authMode === 'forgot'" type="button" @click="setAuthMode('recover')" class="font-bold text-slate-300 hover:text-white">{{ t('auth.useCode') }}</button>
          <button v-else-if="authMode === 'recover' && authOptions.emailEnabled" type="button" @click="setAuthMode('forgot')" class="font-bold text-slate-300 hover:text-white">{{ t('auth.useEmail') }}</button>
          <button type="button" @click="setAuthMode('login')" class="font-bold text-accent hover:underline">
            {{ authMode === 'reset' && isAuthenticated ? t('common.cancel') : t('auth.backToLogin') }}
          </button>
        </div>
        <p v-if="authMode === 'recover'" class="mt-5 text-center text-xs leading-relaxed text-slate-500">{{ t('auth.codeInfo') }}</p>
        <p v-if="authMode === 'register'" class="mt-5 text-center text-xs leading-relaxed text-slate-500">{{ t('auth.registerNote') }}</p>
      </form>
    </main>
  </div>
</template>
