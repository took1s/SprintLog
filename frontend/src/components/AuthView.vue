<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { authBusy, authError, authFields, authForm, authMode } = storeToRefs(app);
const { fieldError, submitAuth } = app;
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-md">
      <form @submit.prevent="submitAuth" class="glass-panel w-full max-w-sm rounded-[2rem] border border-accent/20 p-8" novalidate>
          <h1 class="mb-1 text-center text-4xl font-black tracking-tighter text-white">Sprint<span class="text-accent">Log</span></h1>
          <p class="mb-8 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">
              {{ authMode === 'login' ? 'Hybrid tracker · Sign in' : 'Create new identity' }}
          </p>

          <label class="label-xs mb-2" for="auth-user">Username</label>
          <input id="auth-user" v-model="authForm.username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false"
                 class="cyber-input mb-1 w-full rounded-xl p-4 font-mono text-sm" :class="{ 'border-red-500/60': fieldError('username') }" placeholder="athlete_01">
          <p class="mb-4 min-h-[1rem] font-mono text-[10px] text-red-400">{{ fieldError('username') }}</p>

          <label class="label-xs mb-2" for="auth-pass">Password</label>
          <input id="auth-pass" v-model="authForm.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
                 class="cyber-input mb-1 w-full rounded-xl p-4 font-mono text-sm" :class="{ 'border-red-500/60': fieldError('password') }" placeholder="••••••••">
          <p class="mb-6 min-h-[1rem] font-mono text-[10px] text-red-400">{{ fieldError('password') || (authMode === 'register' ? 'Min. 8 characters' : '') }}</p>

          <button type="submit" :disabled="authBusy" class="cyber-btn w-full rounded-xl py-4 font-bold">
              {{ authBusy ? 'Processing...' : authMode === 'login' ? 'Initialize' : 'Create account' }}
          </button>

          <p v-if="authError" class="mt-4 text-center font-mono text-xs text-red-400" role="alert">{{ authError }}</p>

          <div class="mt-6 text-center">
              <button type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; authError = ''; authFields = {}"
                      class="font-mono text-xs uppercase tracking-widest text-accent transition-colors hover:text-white">
                  {{ authMode === 'login' ? '>> Create account' : '<< Back to login' }}
              </button>
          </div>
      </form>
  </div>
</template>
