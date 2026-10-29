<script setup lang="ts">
// Zeigt frisch erzeugte Wiederherstellungscodes genau einmal (nach der Registrierung oder "Neue Codes").
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { useUiStore } from '@/stores/ui';

const app = useAppStore();
const { recoveryCodes, user } = storeToRefs(app);
const { dismissRecoveryCodes } = app;
const { toast } = useUiStore();

const saved = ref(false);
watch(recoveryCodes, () => { saved.value = false; });

const asText = () => [
  `SprintLog recovery codes for "${user.value?.username ?? ''}" (${new Date().toLocaleDateString()})`,
  'Each code can be used once to set a new password if you forget yours.',
  '',
  ...(recoveryCodes.value ?? []),
].join('\n');

async function copy() {
  try {
    await navigator.clipboard.writeText(asText());
    toast('Codes copied.', 'success');
  } catch {
    toast('Copying is not allowed here - use Download.', 'error');
  }
}

function download() {
  const url = URL.createObjectURL(new Blob([asText()], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sprintlog-recovery-codes-${user.value?.username ?? 'account'}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  saved.value = true;
}
</script>

<template>
  <transition name="fade">
    <div v-if="recoveryCodes" class="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-ink/90 p-4 backdrop-blur-md">
      <div class="glass-panel modal-panel w-full max-w-sm rounded-[2rem] border border-yellow-400/30 p-6" role="dialog" aria-modal="true" aria-labelledby="codes-title">
        <h3 id="codes-title" class="mb-1 text-2xl font-black text-white">Recovery <span class="text-yellow-400">codes</span></h3>
        <p class="mb-5 text-xs leading-relaxed text-slate-300">
          If you forget your password, one of these codes lets you set a new one. Each code works once.
          Store them somewhere safe (password manager, screenshot, paper) - they are shown only now.
        </p>
        <ol class="mb-5 grid grid-cols-2 gap-2" data-test="recovery-codes">
          <li v-for="code in recoveryCodes" :key="code" class="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center font-mono text-sm font-bold tracking-wider text-white">{{ code }}</li>
        </ol>
        <div class="mb-4 grid grid-cols-2 gap-2">
          <button type="button" @click="copy" class="cyber-outline-btn rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-widest">Copy</button>
          <button type="button" @click="download" class="cyber-outline-btn rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-widest">Download .txt</button>
        </div>
        <label class="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs text-slate-200">
          <input v-model="saved" type="checkbox" class="h-5 w-5 accent-[#facc15]"> I saved the codes somewhere safe
        </label>
        <button type="button" :disabled="!saved" @click="dismissRecoveryCodes" class="cyber-btn w-full rounded-xl py-3 font-bold">Continue</button>
      </div>
    </div>
  </transition>
</template>
