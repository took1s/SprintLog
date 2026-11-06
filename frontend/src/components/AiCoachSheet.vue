<script setup lang="ts">
// Chat mit dem KI-Coach. Antworten sind reiner Text (kein HTML/Markdown-Rendering - sicher und CSP-konform).
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { deviceOnline, useAiStore } from '@/stores/ai';
import AiActionCard from './AiActionCard.vue';
import AiText from './AiText.vue';

const ai = useAiStore();
const { open, messages, busy, error, status, mode, applying, profileFilled } = storeToRefs(ai);
// Geräte-Netz statt Sync-Status (der kann nach einem einzelnen Fehlschlag fälschlich "offline" melden)
const online = deviceOnline;

const draft = ref('');
const list = ref<HTMLElement | null>(null);
const input = ref<HTMLTextAreaElement | null>(null);
const panel = ref<HTMLElement | null>(null);

/** Vorschläge mit passendem Modus: Bilanz und Stagnation brauchen die gründliche Analyse mit exakten Zahlen. */
const SUGGESTIONS = [
  { key: 'today', mode: 'quick' }, { key: 'week', mode: 'deep' }, { key: 'program', mode: 'deep' }, { key: 'recovery', mode: 'quick' }, { key: 'plateau', mode: 'deep' },
] as const;
const affordable = (m: 'quick' | 'deep') => !status.value || status.value.remaining >= ai.cost(m);
const canSend = computed(() => draft.value.trim().length >= 2 && !busy.value && online.value && affordable(mode.value));
const lastIsUnanswered = computed(() => messages.value[messages.value.length - 1]?.role === 'user');
/** Mit Pluralformen - "1 подробных вопросов" wäre falsch, und gerade kurz vor dem Limit schaut man hin. */
const remaining = computed(() => t('ai.left', { quick: tn('ai.leftQuick', ai.left('quick')), deep: tn('ai.leftDeep', ai.left('deep')) }));
/** Warum gerade nichts gesendet werden kann (offline / Tageslimit) - sonst wirkt der graue Senden-Knopf kaputt. */
const blocked = computed<'offline' | 'ai_quota' | null>(() => {
  if (!online.value) return error.value === 'offline' ? null : 'offline';
  if (status.value && !affordable(mode.value)) return error.value === 'ai_quota' ? null : 'ai_quota';
  return null;
});

async function send(text = draft.value, m?: 'quick' | 'deep') {
  const q = text.trim();
  if (q.length < 2 || busy.value) return;
  if (m) mode.value = m;
  if (text === draft.value) draft.value = '';
  await ai.ask(q);
}

function onKey(e: KeyboardEvent) {
  // Enter sendet, Shift+Enter = neue Zeile (auf dem Handy gibt es meist nur die Senden-Taste)
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); }
}

/** Eingabefeld wächst mit dem Text (bis max-h-32), statt den Platzhalter abzuschneiden. */
function autoGrow() {
  const el = input.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}
watch(draft, () => nextTick(autoGrow));

const scrollDown = () => nextTick(() => { const el = list.value; if (el) el.scrollTop = el.scrollHeight; });
watch(() => [messages.value.length, busy.value, error.value], scrollDown);

/**
 * Fokus beim Öffnen: mit Maus/Tastatur direkt ins Eingabefeld; auf Touch-Geräten nur in den Dialog
 * (sonst verdeckt die Tastatur sofort die Vorschläge - die 1-Tipp-Aktionen).
 */
function focusStart() {
  void nextTick(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) input.value?.focus({ preventScroll: true });
    else panel.value?.focus({ preventScroll: true });
  });
}

/**
 * Screenreader: nur neue Antworten und "denkt nach" ansagen - nicht den ganzen Verlauf beim Öffnen
 * und nicht die eigene Frage (die steht ja schon im Eingabefeld).
 */
const announce = ref('');
watch(busy, (b) => { if (b) announce.value = t('ai.thinking'); });
watch(() => messages.value.length, (n, prev) => {
  const last = messages.value[n - 1];
  if (n > prev && last?.role === 'assistant') {
    // Vorschlags-Karten mit ansagen - sonst erfährt man ohne Blick auf den Bildschirm nicht, dass es etwas zu speichern gibt
    const cards = (last.actions ?? []).map((a) => t(`ai.actions.${a.type}`));
    announce.value = [`${t('ai.coach')}: ${last.content}`, ...cards].join('. ');
  }
});

// Beim Schließen den Fokus zurück auf den auslösenden Knopf ("Спросить тренера").
let opener: HTMLElement | null = null;
// immediate: die Komponente wird erst beim ersten Öffnen geladen - dann ist open schon true.
watch(open, (o) => {
  if (o) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    scrollDown();
    focusStart();
  } else {
    announce.value = '';
    const el = opener;
    opener = null;
    void nextTick(() => { if (el?.isConnected) el.focus({ preventScroll: true }); });
  }
}, { immediate: true });

async function clearChat() {
  await ai.clearChat();
  // Der Löschen-Knopf verschwindet mit dem Verlauf - Fokus nicht im Nichts lassen
  if (!messages.value.length) focusStart();
}

function retry() {
  // Der Fehlerkasten samt Knopf verschwindet sofort - Fokus vorher sichern
  focusStart();
  void ai.retry();
}

const close = () => { open.value = false; };
</script>

<template>
  <transition name="fade">
      <!-- .stop: sonst schließt der globale Escape-Handler (app.closeTopLayer) zusätzlich die Ebene darunter -->
      <div v-if="open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="close" @keydown.esc.stop="close">
          <!-- dvh statt vh: in Safari ist 92vh höher als der sichtbare Bereich, das Eingabefeld läge hinter der Toolbar -->
          <div ref="panel" tabindex="-1" class="glass-panel modal-panel flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl outline-none sm:h-[85dvh] sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="ai-title" data-test="ai-chat">
              <header class="flex items-start justify-between gap-3 border-b border-white/5 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('ai.kicker') }}</p>
                      <h2 id="ai-title" class="display mt-1 break-words text-2xl text-white">{{ t('ai.title') }}</h2>
                      <p v-if="status?.enabled" class="mt-0.5 font-mono text-[11px]" :class="ai.left('deep') < 1 ? 'text-orange-300' : 'text-slate-400'" data-test="ai-remaining">{{ remaining }}</p>
                  </div>
                  <div class="flex flex-shrink-0 gap-2">
                      <button v-if="messages.length" type="button" @click="clearChat" class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('ai.clear.button')" data-test="ai-clear">
                          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
                      </button>
                      <button type="button" @click="close" class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
                  </div>
              </header>

              <!-- Kein aria-live auf dem Verlauf (würde beim Öffnen/eigenen Fragen alles vorlesen) - Ansage über die Region unten -->
              <div ref="list" class="flex flex-1 flex-col overflow-y-auto px-6 py-4" data-test="ai-messages">
                  <!-- mt-auto: Inhalt hängt unten am Eingabefeld - Vorschläge und neue Antworten liegen im Daumenbereich -->
                  <div class="mt-auto space-y-3">
                      <template v-if="!messages.length">
                          <p class="text-sm leading-relaxed text-slate-300">{{ t('ai.empty') }}</p>
                          <button v-if="!profileFilled" type="button" @click="ai.openProfile()" class="flex min-h-[2.75rem] w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-left text-sm leading-snug text-slate-200" data-test="ai-profile-hint">
                              <svg class="h-5 w-5 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path stroke-linecap="round" d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>
                              <span>{{ t('ai.profile.hint') }}</span>
                          </button>
                          <div class="flex flex-wrap gap-2 pt-1">
                              <button v-for="s in SUGGESTIONS" :key="s.key" type="button" @click="send(t(`ai.suggestions.${s.key}`), s.mode)" :disabled="busy || !online || !affordable(s.mode)"
                                      class="min-h-[2.75rem] rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left text-sm leading-snug text-slate-200 hover:border-white/20 disabled:opacity-50" :data-suggestion="s.key">{{ t(`ai.suggestions.${s.key}`) }}</button>
                          </div>
                      </template>

                      <div v-for="(m, i) in messages" :key="i">
                          <div class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
                              <div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed" :data-role="m.role"
                                   :class="m.role === 'user' ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-white/10 bg-white/[0.05] text-slate-100'">
                                  <span class="sr-only">{{ m.role === 'user' ? t('ai.you') : t('ai.coach') }}: </span>
                                  <AiText v-if="m.role === 'assistant'" :text="m.content" />
                                  <p v-else class="whitespace-pre-line break-words">{{ m.content }}</p>
                              </div>
                          </div>
                          <!-- Vorschläge in voller Breite unter der Antwort: in der Blase wären Tagesliste und Knopf zu gedrängt -->
                          <div v-if="m.actions?.length" class="mt-2 space-y-2">
                              <AiActionCard v-for="(a, j) in m.actions" :key="j" :action="a" :applied="!!m.applied?.includes(j)" :busy="applying === `${i}:${j}`" @apply="ai.applyAction(i, j)" />
                          </div>
                      </div>

                      <div v-if="busy" class="flex justify-start" data-test="ai-thinking">
                          <div class="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
                              <!-- motion-reduce: die globale 0.01ms-Regel ließe die Endlos-Animation flackern -->
                              <span class="flex gap-1" aria-hidden="true">
                                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 motion-reduce:animate-none"></span>
                                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms] motion-reduce:animate-none"></span>
                                  <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms] motion-reduce:animate-none"></span>
                              </span>
                              {{ t('ai.thinking') }}
                          </div>
                      </div>

                      <div v-if="error" class="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert" :data-error="error">
                          {{ t(`ai.errors.${error}`) }}
                          <button v-if="lastIsUnanswered && error !== 'ai_quota' && error !== 'ai_disabled'" type="button" @click="retry" class="mt-1 block min-h-[2.75rem] font-bold underline underline-offset-2" data-test="ai-retry">{{ t('ai.retry') }}</button>
                      </div>
                  </div>
              </div>

              <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announce }}</p>

              <form class="border-t border-white/5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" @submit.prevent="send()">
                  <p v-if="blocked" class="mb-2 px-1 text-xs leading-snug text-orange-300" data-test="ai-blocked">{{ t(`ai.errors.${blocked}`) }}</p>
                  <!-- Aktiver Modus mit klarer Kante (wie "Kein Spiel" im Plan-Builder): Gründlich kostet 4x so viel, der Zustand muss eindeutig sein -->
                  <div class="mb-2 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1" role="radiogroup" :aria-label="t('ai.mode.label')" aria-describedby="ai-mode-hint">
                      <button v-for="m in (['quick', 'deep'] as const)" :key="m" type="button" role="radio" :aria-checked="mode === m" @click="mode = m" :title="t(`ai.mode.${m}Hint`)"
                              class="flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition-colors"
                              :class="mode === m ? 'border-white/60 bg-white/10 text-white' : 'border-transparent text-slate-400 hover:text-white'" :data-test="`ai-mode-${m}`">
                          <svg v-if="m === 'deep'" class="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/></svg>
                          {{ t(`ai.mode.${m}`) }}
                      </button>
                  </div>
                  <p id="ai-mode-hint" class="sr-only">{{ t(`ai.mode.${mode}Hint`) }}</p>
                  <div class="flex items-end gap-2">
                      <label for="ai-input" class="sr-only">{{ t('ai.placeholder') }}</label>
                      <textarea id="ai-input" ref="input" v-model="draft" rows="1" maxlength="1000" enterkeyhint="send" @keydown="onKey" :placeholder="t('ai.placeholder')"
                                class="cyber-input max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl px-4 py-2.5 text-base" data-test="ai-input"></textarea>
                      <!-- Kein zusätzliches opacity: .btn-primary:disabled ist schon gedämpft, sonst wäre der Knopf unsichtbar -->
                      <button type="submit" :disabled="!canSend" class="btn-primary flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl" :aria-label="t('ai.send')" data-test="ai-send">
                          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h13M13 6l6 6-6 6"/></svg>
                      </button>
                  </div>
                  <p class="mt-2 px-1 text-[11px] leading-snug text-slate-400">{{ t('ai.disclaimer') }} {{ t('ai.privacy') }}</p>
              </form>
          </div>
      </div>
  </transition>
</template>
