<script setup lang="ts">
// Einstellungen > Sicherheit: E-Mail für den Passwort-Reset, Passwort ändern, Wiederherstellungscodes, überall abmelden.
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';

const app = useAppStore();
const { profile, security, authOptions, online } = storeToRefs(app);
const { openSecurity, changePassword, saveEmail, regenerateRecoveryCodes, logoutEverywhere } = app;

const toggle = (section: 'password' | 'email' | 'codes') => openSecurity(security.value.section === section ? '' : section);
</script>

<template>
  <section class="mb-6" data-test="security">
    <h4 class="label-xs mb-3 text-accent">Security</h4>
    <div class="space-y-2">
      <!-- E-Mail -->
      <div v-if="authOptions.emailEnabled" class="rounded-xl border border-white/5 bg-black/20">
        <button type="button" @click="toggle('email')" class="flex w-full items-center justify-between p-3 text-left">
          <span class="text-sm text-slate-200">E-mail for password reset</span>
          <span class="font-mono text-[10px]" :class="profile?.emailVerified ? 'text-emerald-400' : profile?.email ? 'text-orange-300' : 'text-slate-500'">
            {{ profile?.email ? (profile.emailVerified ? 'confirmed' : 'not confirmed') : 'not set' }}
          </span>
        </button>
        <form v-if="security.section === 'email'" @submit.prevent="saveEmail()" class="border-t border-white/5 p-3">
          <p v-if="profile?.email" class="mb-2 break-all font-mono text-[10px] text-slate-400">{{ profile.email }}</p>
          <input v-model="security.email" type="email" autocomplete="email" placeholder="you@example.com" class="cyber-input mb-2 w-full rounded-xl p-3 text-sm">
          <input v-model="security.current" type="password" autocomplete="current-password" placeholder="Confirm with password" class="cyber-input mb-2 w-full rounded-xl p-3 text-sm">
          <div class="grid grid-cols-2 gap-2">
            <button type="button" v-if="profile?.email" @click="saveEmail(true)" :disabled="security.busy || !security.current" class="rounded-xl bg-white/5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 disabled:opacity-40">Remove</button>
            <button type="submit" :disabled="security.busy || !online" class="cyber-btn rounded-xl py-2.5 text-[10px] font-bold" :class="{ 'col-span-2': !profile?.email }">{{ profile?.email && !profile.emailVerified ? 'Resend link' : 'Save' }}</button>
          </div>
        </form>
      </div>

      <!-- Passwort -->
      <div class="rounded-xl border border-white/5 bg-black/20">
        <button type="button" @click="toggle('password')" class="flex w-full items-center justify-between p-3 text-left">
          <span class="text-sm text-slate-200">Change password</span>
          <span class="font-mono text-[10px] text-slate-500">logs out other devices</span>
        </button>
        <form v-if="security.section === 'password'" @submit.prevent="changePassword" class="border-t border-white/5 p-3">
          <input v-model="security.current" type="password" autocomplete="current-password" placeholder="Current password" class="cyber-input mb-2 w-full rounded-xl p-3 text-sm">
          <input v-model="security.next" type="password" autocomplete="new-password" placeholder="New password (min. 8)" class="cyber-input mb-2 w-full rounded-xl p-3 text-sm">
          <button type="submit" :disabled="security.busy || !online" class="cyber-btn w-full rounded-xl py-2.5 text-[10px] font-bold">{{ security.busy ? '...' : 'Change password' }}</button>
        </form>
      </div>

      <!-- Wiederherstellungscodes -->
      <div class="rounded-xl border border-white/5 bg-black/20">
        <button type="button" @click="toggle('codes')" class="flex w-full items-center justify-between p-3 text-left">
          <span class="text-sm text-slate-200">Recovery codes</span>
          <span class="font-mono text-[10px]" :class="(profile?.recoveryCodesRemaining ?? 10) <= 2 ? 'text-orange-300' : 'text-slate-500'">
            {{ profile ? `${profile.recoveryCodesRemaining} of 10 left` : '' }}
          </span>
        </button>
        <form v-if="security.section === 'codes'" @submit.prevent="regenerateRecoveryCodes" class="border-t border-white/5 p-3">
          <p class="mb-2 text-xs text-slate-400">New codes replace all old ones. Use them if you forget your password.</p>
          <input v-model="security.current" type="password" autocomplete="current-password" placeholder="Confirm with password" class="cyber-input mb-2 w-full rounded-xl p-3 text-sm">
          <button type="submit" :disabled="security.busy || !online" class="cyber-btn w-full rounded-xl py-2.5 text-[10px] font-bold">Generate new codes</button>
        </form>
      </div>

      <p v-if="security.error" class="font-mono text-[10px] text-red-400" role="alert">{{ security.error }}</p>
      <p v-if="security.notice" class="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-300" role="status">{{ security.notice }}</p>

      <button type="button" @click="logoutEverywhere" :disabled="!online" class="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-white disabled:opacity-40">Log out on all devices</button>
    </div>
  </section>
</template>
