<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { t } from '@/i18n';

const app = useAppStore();
const { authBusy, authError, authNotice, authForm, authMode, authOptions, isAuthenticated } = storeToRefs(app);
const { fieldError, submitAuth, setAuthMode } = app;

const subtitle = computed(() => t(`auth.subtitle.${authMode.value}`));
const submitLabel = computed(() => (authBusy.value ? t('common.processing') : t(`auth.submit.${authMode.value}`)));
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-md">
    <form @submit.prevent="submitAuth" class="glass-panel w-full max-w-sm rounded-[2rem] border border-accent/20 p-8" novalidate>
      <h1 class="mb-1 text-center text-4xl font-black tracking-tighter text-white">Sprint<span class="text-accent">Log</span></h1>
      <p class="mb-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">{{ subtitle }}</p>

      <!-- Benutzername: Login, Registrierung, Wiederherstellung -->
      <template v-if="authMode === 'login' || authMode === 'register' || authMode === 'recover'">
        <label class="label-xs mb-2" for="auth-user">{{ t('auth.username') }}</label>
        <input id="auth-user" v-model="authForm.username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false"
               class="cyber-input mb-1 w-full rounded-xl p-4 font-mono text-sm" :class="{ 'border-red-500/60': fieldError('username') }" placeholder="athlete_01">
        <p class="mb-4 min-h-[1rem] font-mono text-[10px] text-red-400">{{ fieldError('username') }}</p>
      </template>

      <template v-if="authMode === 'login' || authMode === 'register'">
        <label class="label-xs mb-2" for="auth-pass">{{ t('auth.password') }}</label>
        <input id="auth-pass" v-model="authForm.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
               class="cyber-input mb-1 w-full rounded-xl p-4 font-mono text-sm" :class="{ 'border-red-500/60': fieldError('password') }" placeholder="••••••••">
        <p class="mb-6 min-h-[1rem] font-mono text-[10px] text-red-400">{{ fieldError('password') || (authMode === 'register' ? t('auth.minChars') : '') }}</p>
      </template>

      <template v-if="authMode === 'recover'">
        <label class="label-xs mb-2" for="auth-code">{{ t('auth.recoveryCode') }}</label>
        <input id="auth-code" v-model="authForm.code" type="text" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false"
               class="cyber-input mb-1 w-full rounded-xl p-4 font-mono text-sm uppercase tracking-widest" :class="{ 'border-red-500/60': fieldError('code') }" placeholder="XXXXX-XXXXX">
        <p class="mb-4 min-h-[1rem] font-mono text-[10px] text-red-400">{{ fieldError('code') }}</p>
      </template>

      <template v-if="authMode === 'forgot'">
        <label class="label-xs mb-2" for="auth-login">{{ t('auth.usernameOrEmail') }}</label>
        <input id="auth-login" v-model="authForm.login" type="text" autocomplete="username" autocapitalize="none" spellcheck="false"
               class="cyber-input mb-6 w-full rounded-xl p-4 font-mono text-sm" :placeholder="t('auth.loginPlaceholder')">
      </template>

      <template v-if="authMode === 'recover' || authMode === 'reset'">
        <label class="label-xs mb-2" for="auth-new">{{ t('auth.newPassword') }}</label>
        <input id="auth-new" v-model="authForm.newPassword" type="password" autocomplete="new-password"
               class="cyber-input mb-1 w-full rounded-xl p-4 font-mono text-sm" :class="{ 'border-red-500/60': fieldError('newpassword') }" placeholder="••••••••">
        <p class="mb-6 min-h-[1rem] font-mono text-[10px] text-red-400">{{ fieldError('newpassword') || t('auth.minChars') }}</p>
      </template>

      <p v-if="authNotice" class="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-300" role="status">{{ authNotice }}</p>

      <button type="submit" :disabled="authBusy || (authMode === 'forgot' && !!authNotice)" class="cyber-btn w-full rounded-xl py-4 font-bold">{{ submitLabel }}</button>

      <p v-if="authError" class="mt-4 text-center font-mono text-xs text-red-400" role="alert">{{ authError }}</p>

      <div class="mt-6 flex flex-col items-center gap-3 text-center">
        <template v-if="authMode === 'login'">
          <button type="button" data-test="to-register" @click="setAuthMode('register')" class="font-mono text-xs uppercase tracking-widest text-accent transition-colors hover:text-white">{{ t('auth.createAccount') }}</button>
          <button type="button" data-test="forgot" @click="setAuthMode(authOptions.emailEnabled ? 'forgot' : 'recover')" class="font-mono text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-white">{{ t('auth.forgot') }}</button>
        </template>
        <template v-else-if="authMode === 'forgot' || authMode === 'recover'">
          <button v-if="authMode === 'forgot'" type="button" @click="setAuthMode('recover')" class="font-mono text-[10px] uppercase tracking-widest text-slate-400 transition-colors hover:text-white">{{ t('auth.useCode') }}</button>
          <button v-else-if="authOptions.emailEnabled" type="button" @click="setAuthMode('forgot')" class="font-mono text-[10px] uppercase tracking-widest text-slate-400 transition-colors hover:text-white">{{ t('auth.useEmail') }}</button>
          <button type="button" @click="setAuthMode('login')" class="font-mono text-xs uppercase tracking-widest text-accent transition-colors hover:text-white">{{ t('auth.backToLogin') }}</button>
        </template>
        <button v-else-if="authMode === 'reset'" type="button" @click="setAuthMode('login')" class="font-mono text-xs uppercase tracking-widest text-accent transition-colors hover:text-white">
          {{ isAuthenticated ? t('common.cancel') : t('auth.backToLogin') }}
        </button>
        <button v-else type="button" @click="setAuthMode('login')" class="font-mono text-xs uppercase tracking-widest text-accent transition-colors hover:text-white">{{ t('auth.backToLogin') }}</button>
      </div>

      <p v-if="authMode === 'recover'" class="mt-6 text-center font-mono text-[10px] leading-relaxed text-slate-500">
        {{ t('auth.codeInfo') }}
      </p>
    </form>
  </div>
</template>
