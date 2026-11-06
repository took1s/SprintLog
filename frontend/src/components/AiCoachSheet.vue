<script setup lang="ts">
// Chat mit dem KI-Coach. Antworten sind reiner Text (kein HTML/Markdown-Rendering - sicher und CSP-konform).
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { deviceOnline, useAiStore } from '@/stores/ai';
import { useAppStore } from '@/stores/app';
import AiActionCard from './AiActionCard.vue';
import AiText from './AiText.vue';
import HoldButton from './HoldButton.vue';
import MemoryIcon from './MemoryIcon.vue';
import { vSheetDrag } from '@/lib/gestures';

const ai = useAiStore();
const { open, messages, busy, error, status, mode, applying, profileFilled, memory } = storeToRefs(ai);
// Im Training: der Coach sieht die laufende Einheit und kann sie ändern
const appStore = useAppStore();
const { sessionActive, isEditing } = storeToRefs(appStore);
const live = computed(() => sessionActive.value && !isEditing.value);
const LIVE_SUGGESTIONS = [
  { key: 'busy', mode: 'quick' }, { key: 'easy', mode: 'quick' }, { key: 'short', mode: 'quick' }, { key: 'pain', mode: 'deep' },
] as const;
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
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Neue Antwort: gleitet herein; Blöcke und Karten erscheinen nacheinander. Nur in diesem Öffnen, nicht beim Wiederöffnen. */
const fresh = ref(-1);

/**
 * Nach neuen Nachrichten weich mitscrollen. Lange Antwort: an ihren Anfang springen statt ans Ende -
 * man liest von oben, nicht vom letzten Satz rückwärts.
 */
function followLatest() {
  void nextTick(() => {
    const el = list.value;
    if (!el) return;
    const behavior: ScrollBehavior = reduceMotion() ? 'auto' : 'smooth';
    const n = messages.value.length - 1;
    const node = el.querySelector<HTMLElement>(`[data-msg="${n}"]`);
    if (!busy.value && messages.value[n]?.role === 'assistant' && node && node.offsetHeight > el.clientHeight * 0.7) {
      el.scrollTo({ top: el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 12, behavior });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  });
}
watch(() => [messages.value.length, busy.value, error.value], followLatest);

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
    fresh.value = n - 1;
    // Vorschlags-Karten mit ansagen - sonst erfährt man ohne Blick auf den Bildschirm nicht, dass es etwas zu speichern gibt
    const cards = (last.actions ?? []).map((a) => t(`ai.actions.${a.type}`));
    const notes = (last.memory ?? []).map((c) => `${t(`ai.memory.${c.action}`)}: ${c.content}`);
    announce.value = [`${t('ai.coach')}: ${last.content}`, ...notes, ...cards].join('. ');
  }
});

// Beim Schließen den Fokus zurück auf den auslösenden Knopf ("Спросить тренера").
let opener: HTMLElement | null = null;
// immediate: die Komponente wird erst beim ersten Öffnen geladen - dann ist open schon true.
watch(open, (o) => {
  if (o) {
    fresh.value = -1;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    scrollDown();
    focusStart();
  } else {
    announce.value = '';
  }
}, { immediate: true });

/** Fokus erst nach der Schließ-Animation zurückgeben - vorher hängt der Body noch fest (Scroll-Sperre). */
function restoreFocus() {
  const el = opener;
  opener = null;
  if (el?.isConnected && window.matchMedia?.('(pointer: fine)').matches) el.focus({ preventScroll: true });
}

async function clearChat(confirmed = false) {
  await ai.clearChat({ confirmed });
  // Der Löschen-Knopf verschwindet mit dem Verlauf - Fokus nicht im Nichts lassen
  if (!messages.value.length) focusStart();
}

function retry() {
  // Der Fehlerkasten samt Knopf verschwindet sofort - Fokus vorher sichern
  focusStart();
  void ai.retry();
}

// Tastatur zuerst schließen: sonst ändert iOS die Fenstergröße mitten in der Schließ-Animation (kurzes weißes Aufblitzen)
const close = () => {
  if (document.activeElement instanceof HTMLElement && panel.value?.contains(document.activeElement)) document.activeElement.blur();
  open.value = false;
};
</script>

<template>
  <transition name="sheet" @after-leave="restoreFocus">
      <!-- .stop: sonst schließt der globale Escape-Handler (app.closeTopLayer) zusätzlich die Ebene darunter -->
      <div v-if="open" class="fixed inset-0 z-[70] flex items-end justify-center bg-ink/80 sm:items-center" @click.self="close" @keydown.esc.stop="close">
          <!-- dvh statt vh: in Safari ist 92vh höher als der sichtbare Bereich, das Eingabefeld läge hinter der Toolbar -->
          <div v-sheet-drag="close" ref="panel" tabindex="-1" class="glass-panel modal-panel flex h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl outline-none sm:h-[85dvh] sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="ai-title" data-test="ai-chat">
              <header class="flex items-start justify-between gap-3 border-b border-white/5 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('ai.kicker') }}</p>
                      <h2 id="ai-title" class="display mt-1 break-words text-2xl text-white">{{ t('ai.title') }}</h2>
                      <p v-if="status?.enabled" class="mt-0.5 font-mono text-[11px]" :class="ai.left('deep') < 1 ? 'text-orange-300' : 'text-slate-400'" data-test="ai-remaining">{{ remaining }}</p>
                  </div>
                  <div class="flex flex-shrink-0 gap-2">
                      <!-- Gedächtnis: was sich der Coach gemerkt hat (Zahl = Einträge) -->
                      <button type="button" @click="ai.openMemory()" class="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                              :aria-label="memory.length ? t('ai.memory.openCount', { n: memory.length }) : t('ai.memory.open')" data-test="ai-memory">
                          <MemoryIcon category="brain" class="h-5 w-5" />
                          <span v-if="memory.length" class="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-on-accent" aria-hidden="true">{{ memory.length }}</span>
                      </button>
                      <!-- Gedrückt halten löscht (Ring füllt sich); Tastatur/Screenreader bekommen die Rückfrage -->
                      <HoldButton v-if="messages.length" variant="icon" :label="t('ai.clear.button')" @confirm="clearChat(true)" @fallback="clearChat()"
                                  class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" data-test="ai-clear">
                          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
                      </HoldButton>
                      <button type="button" @click="close" class="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
                  </div>
              </header>

              <!-- Kein aria-live auf dem Verlauf (würde beim Öffnen/eigenen Fragen alles vorlesen) - Ansage über die Region unten -->
              <div ref="list" class="flex flex-1 flex-col overflow-y-auto px-6 py-4" data-test="ai-messages">
                  <!-- mt-auto: Inhalt hängt unten am Eingabefeld - Vorschläge und neue Antworten liegen im Daumenbereich -->
                  <div class="mt-auto space-y-3">
                      <!-- Im Training: Hinweis, dass der Coach die Einheit sieht, und passende Schnellfragen -->
                      <div v-if="live" class="rounded-2xl border border-accent/40 bg-accent/5 px-3.5 py-3" data-test="ai-live">
                          <p class="flex items-center gap-2 text-[10px] font-bold uppercase text-accent tracking-label">
                              <span class="live-dot" aria-hidden="true"></span>{{ t('ai.live.kicker') }}
                          </p>
                          <p class="mt-1 text-xs leading-relaxed text-slate-300">{{ t('ai.live.hint') }}</p>
                          <div v-if="!busy" class="mt-2 flex flex-wrap gap-1.5">
                              <button v-for="s in LIVE_SUGGESTIONS" :key="s.key" type="button" @click="send(t(`ai.live.suggestions.${s.key}`), s.mode)" :disabled="!online || !affordable(s.mode)"
                                      class="min-h-[2.75rem] rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[13px] leading-snug text-slate-200 hover:border-white/20 disabled:opacity-50" :data-live-suggestion="s.key">{{ t(`ai.live.suggestions.${s.key}`) }}</button>
                          </div>
                      </div>
                      <template v-if="!messages.length">
                          <p class="text-sm leading-relaxed text-slate-300">{{ t('ai.empty') }}</p>
                          <button v-if="!profileFilled" type="button" @click="ai.openProfile()" class="flex min-h-[2.75rem] w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-left text-sm leading-snug text-slate-200" data-test="ai-profile-hint">
                              <svg class="h-5 w-5 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path stroke-linecap="round" d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>
                              <span>{{ t('ai.profile.hint') }}</span>
                          </button>
                          <div v-if="!live" class="flex flex-wrap gap-2 pt-1">
                              <button v-for="s in SUGGESTIONS" :key="s.key" type="button" @click="send(t(`ai.suggestions.${s.key}`), s.mode)" :disabled="busy || !online || !affordable(s.mode)"
                                      class="min-h-[2.75rem] rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left text-sm leading-snug text-slate-200 hover:border-white/20 disabled:opacity-50" :data-suggestion="s.key">{{ t(`ai.suggestions.${s.key}`) }}</button>
                          </div>
                      </template>

                      <TransitionGroup name="msg">
                      <div v-for="(m, i) in messages" :key="i" :data-msg="i" :class="{ 'msg-fresh': i === fresh }">
                          <div class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
                              <div class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed" :data-role="m.role"
                                   :class="m.role === 'user' ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-white/10 bg-white/[0.05] text-slate-100'">
                                  <span class="sr-only">{{ m.role === 'user' ? t('ai.you') : t('ai.coach') }}: </span>
                                  <AiText v-if="m.role === 'assistant'" :text="m.content" />
                                  <p v-else class="whitespace-pre-line break-words">{{ m.content }}</p>
                              </div>
                          </div>
                          <!-- Gedächtnis-Hinweise: was der Coach sich gerade gemerkt hat - antippen öffnet das Gedächtnis, "Rückgängig" vergisst es -->
                          <ul v-if="m.memory?.length" class="mt-2 space-y-1.5" data-test="memory-notes">
                              <li v-for="c in m.memory" :key="c.id" class="memory-note flex items-center gap-1 rounded-xl border border-accent/25 bg-accent/5 pl-3 pr-1 text-xs text-slate-200" :data-memory-action="c.undone ? 'undone' : c.action">
                                  <MemoryIcon category="brain" class="h-4 w-4 flex-shrink-0 text-accent" />
                                  <button type="button" class="min-h-[2.75rem] min-w-0 flex-1 py-1.5 pl-1 text-left leading-snug" @click="ai.openMemory()">
                                      <span class="font-bold text-accent">{{ t(`ai.memory.${c.undone ? 'undone' : c.action}`) }}: </span>
                                      <span class="break-words" :class="{ 'text-slate-400 line-through': c.undone || c.action === 'forgotten' }">{{ c.content }}</span>
                                  </button>
                                  <button v-if="c.action === 'saved' && !c.undone" type="button" @click="ai.undoMemory(i, c)" data-test="memory-undo"
                                          class="min-h-[2.75rem] flex-shrink-0 rounded-lg px-3 text-[11px] font-bold uppercase text-slate-300 tracking-label hover:bg-white/5 hover:text-white">{{ t('ai.memory.undo') }}</button>
                              </li>
                          </ul>
                          <!-- Vorschläge in voller Breite unter der Antwort: in der Blase wären Tagesliste und Knopf zu gedrängt -->
                          <div v-if="m.actions?.length" class="mt-2 space-y-2">
                              <AiActionCard v-for="(a, j) in m.actions" :key="j" :action="a" :applied="!!m.applied?.includes(j)" :busy="applying === `${i}:${j}`" @apply="ai.applyAction(i, j)" />
                          </div>
                      </div>
                      </TransitionGroup>

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
