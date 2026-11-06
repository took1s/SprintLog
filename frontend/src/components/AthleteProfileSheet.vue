<script setup lang="ts">
// Sportler-Profil für den KI-Coach. Alle Felder optional; gespeichert wird lokal + Server (offline nachgereicht).
import { nextTick, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import DecimalInput from '@/components/DecimalInput.vue';
import { POSITIONS, emptyProfile, useAiStore, type AthleteProfile } from '@/stores/ai';
import { vSheetDrag } from '@/lib/gestures';
import MemoryIcon from './MemoryIcon.vue';

const ai = useAiStore();
const { profile, profileOpen, profileBusy, memory } = storeToRefs(ai);
const panel = ref<HTMLElement | null>(null);

// Bearbeitungskopie: erst "Speichern" übernimmt
const form = reactive<AthleteProfile>(emptyProfile());

/**
 * Fokus: Das Profil liegt über Chat oder Einstellungen. Ohne Fokuswechsel bliebe die Tastatur im Dialog darunter
 * (Tab/Escape wirkten dort). Beim Schließen zurück zum Auslöser - der Profil-Hinweis im Chat verschwindet nach dem
 * Speichern, dann auf den Dialog, in dem er stand.
 */
let opener: HTMLElement | null = null;
let openerDialog: HTMLElement | null = null;
// immediate: die Komponente wird erst beim ersten Öffnen geladen - dann ist profileOpen schon true
watch(profileOpen, (o) => {
  if (o) {
    Object.assign(form, emptyProfile(), profile.value);
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openerDialog = opener?.closest<HTMLElement>('[role=dialog]') ?? null;
    void nextTick(() => panel.value?.focus({ preventScroll: true }));
  } else {
    const target = opener?.isConnected ? opener : openerDialog?.isConnected ? openerDialog : null;
    opener = openerDialog = null;
    void nextTick(() => target?.focus({ preventScroll: true }));
  }
}, { immediate: true });

const TEXTS = ['goals', 'injuries', 'equipment', 'notes'] as const;
const thisYear = new Date().getFullYear();
const close = () => { profileOpen.value = false; };
const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);

function save() {
  void ai.saveProfile({
    ...form,
    level: clean(form.level), goals: clean(form.goals), injuries: clean(form.injuries), equipment: clean(form.equipment), notes: clean(form.notes),
    birthYear: form.birthYear ? Math.round(form.birthYear) : null,
    heightCm: form.heightCm ? Math.round(form.heightCm) : null,
    sessionMinutes: form.sessionMinutes ? Math.round(form.sessionMinutes) : null,
  });
}
</script>

<template>
  <transition name="sheet">
      <!-- .stop: der globale Escape-Handler würde sonst auch die Einstellungen darunter schließen -->
      <div v-if="profileOpen" class="fixed inset-0 z-[75] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="close" @keydown.esc.stop="close">
          <form v-sheet-drag:handle="close" ref="panel" tabindex="-1" class="glass-panel modal-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl outline-none sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="profile-title" data-test="athlete-profile" @submit.prevent="save">
              <div class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('ai.profile.kicker') }}</p>
                      <h2 id="profile-title" class="display mt-1 break-words text-2xl text-white">{{ t('ai.profile.title') }}</h2>
                      <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ t('ai.profile.intro') }}</p>
                  </div>
                  <button type="button" @click="close" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </div>

              <div class="flex-1 space-y-5 overflow-y-auto px-6 pb-4">
                  <fieldset>
                      <legend class="label-xs mb-2">{{ t('ai.profile.fields.position') }}</legend>
                      <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('ai.profile.fields.position')">
                          <button v-for="p in POSITIONS" :key="p" type="button" role="radio" :aria-checked="form.position === p" @click="form.position = form.position === p ? null : p"
                                  class="min-h-[2.75rem]" :class="form.position === p ? 'chip chip-active' : 'chip chip-idle'" :data-position="p">{{ t(`ai.profile.positions.${p}`) }}</button>
                      </div>
                  </fieldset>

                  <div class="grid grid-cols-3 items-end gap-2">
                      <label class="block">
                          <span class="label-xs mb-1.5 block">{{ t('ai.profile.fields.height') }}</span>
                          <DecimalInput v-model="form.heightCm" integer class="cyber-input w-full rounded-xl px-3 py-2.5 text-base" data-test="profile-height" />
                      </label>
                      <label class="block">
                          <span class="label-xs mb-1.5 block">{{ t('ai.profile.fields.weight') }}</span>
                          <DecimalInput v-model="form.weightKg" class="cyber-input w-full rounded-xl px-3 py-2.5 text-base" data-test="profile-weight" />
                      </label>
                      <label class="block">
                          <span class="label-xs mb-1.5 block">{{ t('ai.profile.fields.birthYear') }}</span>
                          <DecimalInput v-model="form.birthYear" integer :placeholder="String(thisYear - 20)" class="cyber-input w-full rounded-xl px-3 py-2.5 text-base" data-test="profile-birth" />
                      </label>
                  </div>

                  <div class="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-2">
                      <label class="block">
                          <span class="label-xs mb-1.5 block">{{ t('ai.profile.fields.level') }}</span>
                          <input v-model="form.level" maxlength="60" :placeholder="t('ai.profile.placeholders.level')" class="cyber-input w-full rounded-xl px-3 py-2.5 text-base" data-test="profile-level">
                      </label>
                      <label class="block">
                          <span class="label-xs mb-1.5 block">{{ t('ai.profile.fields.sessionMinutes') }}</span>
                          <DecimalInput v-model="form.sessionMinutes" integer placeholder="75" class="cyber-input w-full rounded-xl px-3 py-2.5 text-base" data-test="profile-minutes" />
                      </label>
                  </div>

                  <label v-for="f in TEXTS" :key="f" class="block">
                      <span class="label-xs mb-1.5 block">{{ t(`ai.profile.fields.${f}`) }}</span>
                      <textarea v-model="form[f]" rows="2" :maxlength="f === 'equipment' ? 300 : 400" :placeholder="t(`ai.profile.placeholders.${f}`)"
                                class="cyber-input w-full resize-none rounded-xl p-3 text-base" :data-test="`profile-${f}`"></textarea>
                  </label>

                  <!-- Was der Coach sich aus Gesprächen gemerkt hat - ergänzt das Profil -->
                  <button type="button" @click="ai.openMemory()" data-test="profile-memory"
                          class="flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-left text-sm font-bold text-slate-100 hover:border-accent/40">
                      <MemoryIcon category="brain" class="h-5 w-5 flex-shrink-0 text-accent" />
                      <span class="min-w-0 flex-1">{{ memory.length ? t('ai.memory.openCount', { n: memory.length }) : t('ai.memory.open') }}</span>
                      <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg>
                  </button>
              </div>

              <div class="border-t border-white/5 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <button type="submit" :disabled="profileBusy" class="btn-primary flex min-h-[2.75rem] w-full items-center justify-center gap-2 rounded-xl py-3 font-bold" data-test="profile-save">
                      <span v-if="profileBusy" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
                      {{ t('ai.profile.save') }}
                  </button>
              </div>
          </form>
      </div>
  </transition>
</template>
