<script setup lang="ts">
// Chat mit dem KI-Coach. Antworten sind reiner Text (kein HTML/Markdown-Rendering - sicher und CSP-konform).
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAiStore } from '@/stores/ai';
import { useAppStore } from '@/stores/app';

const ai = useAiStore();
const { open, messages, busy, error, status } = storeToRefs(ai);
const { online } = storeToRefs(useAppStore());

const draft = ref('');
const list = ref<HTMLElement | null>(null);
const input = ref<HTMLTextAreaElement | null>(null);
const panel = ref<HTMLElement | null>(null);

const SUGGESTIONS = ['today', 'week', 'recovery', 'plateau'] as const;
const canSend = computed(() => draft.value.trim().length >= 2 && !busy.value && online.value && status.value?.remaining !== 0);
const lastIsUnanswered = computed(() => messages.value[messages.value.length - 1]?.role === 'user');
/** Warum gerade nichts gesendet werden kann (offline / Tageslimit) - sonst wirkt der graue Senden-Knopf kaputt. */
const blocked = computed<'offline' | 'ai_quota' | null>(() => {
  if (!online.value) return error.value === 'offline' ? null : 'offline';
  if (status.value?.remaining === 0) return error.value === 'ai_quota' ? null : 'ai_quota';
  return null;
});

async function send(text = draft.value) {
  const q = text.trim();
  if (q.length < 2 || busy.value) return;
  draft.value = '';
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
  if (n > prev && last?.role === 'assistant') announce.value = `${t('ai.coach')}: ${last.content}`;
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
      <div v-if="open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="close" @keydown.esc="close">
          <!-- dvh statt vh: in Safari ist 92vh höher als der sichtbare Bereich, das Eingabefeld läge hinter der Toolbar -->
          <div ref="panel" tabindex="-1" class="glass-panel modal-panel flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl outline-none sm:h-[85dvh] sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="ai-title" data-test="ai-chat">
              <header class="flex items-start justify-between gap-3 border-b border-white/5 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('ai.kicker') }}</p>
                      <h2 id="ai-title" class="display mt-1 break-words text-2xl text-white">{{ t('ai.title') }}</h2>
                      <p v-if="status?.enabled" class="mt-0.5 font-mono text-[11px]" :class="status.remaining <= 3 ? 'text-orange-300' : 'text-slate-400'" data-test="ai-remaining">{{ t('ai.remaining', { n: status.remaining }) }}</p>
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
                          <div class="flex flex-wrap gap-2 pt-1">
                              <button v-for="s in SUGGESTIONS" :key="s" type="button" @click="send(t(`ai.suggestions.${s}`))" :disabled="busy || !online || status?.remaining === 0"
                                      class="min-h-[2.75rem] rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left text-sm leading-snug text-slate-200 hover:border-white/20 disabled:opacity-50" :data-suggestion="s">{{ t(`ai.suggestions.${s}`) }}</button>
                          </div>
                      </template>

                      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
                          <div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed" :data-role="m.role"
                               :class="m.role === 'user' ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-white/10 bg-white/[0.05] text-slate-100'">
                              <span class="sr-only">{{ m.role === 'user' ? t('ai.you') : t('ai.coach') }}: </span>
                              <p class="whitespace-pre-line break-words">{{ m.content }}</p>
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
