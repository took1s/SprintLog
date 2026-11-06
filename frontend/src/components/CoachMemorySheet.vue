<script setup lang="ts">
// Gedächtnis des KI-Coachs: alles sehen, was er sich gemerkt hat (nach Themen), selbst ergänzen, ändern, löschen.
// Transparenz ist der Punkt: nichts bleibt im Verborgenen, und der Nutzer hat das letzte Wort.
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { vSheetDrag } from '@/lib/gestures';
import { MEMORY_CATEGORIES, deviceOnline, useAiStore, type CoachMemory, type MemoryCategory } from '@/stores/ai';
import HoldButton from './HoldButton.vue';
import MemoryIcon from './MemoryIcon.vue';

const ai = useAiStore();
const { memory, memoryOpen, memoryLoading } = storeToRefs(ai);
const panel = ref<HTMLElement | null>(null);
const input = ref<HTMLTextAreaElement | null>(null);

// Neuer Eintrag
const draft = reactive({ content: '', category: 'other' as MemoryCategory, important: false, busy: false });
const canAdd = computed(() => draft.content.trim().length >= 3 && !draft.busy && deviceOnline.value);

// Bearbeiten (immer nur ein Eintrag)
const editing = reactive({ id: 0, content: '', category: 'other' as MemoryCategory, important: false, busy: false });

const groups = computed(() => MEMORY_CATEGORIES
  .map((c) => ({ category: c, items: memory.value.filter((m) => m.category === c) }))
  .filter((g) => g.items.length));

const tone: Record<MemoryCategory, string> = {
  injury: 'text-red-300', health: 'text-emerald-300', goal: 'text-accent', schedule: 'text-yellow-300',
  preference: 'text-orange-300', equipment: 'text-slate-300', insight: 'text-accent', other: 'text-slate-400',
};

const day = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' });

// Fokus wie beim Profil: das Sheet liegt über Chat oder Profil - beim Schließen zurück zum Auslöser
let opener: HTMLElement | null = null;
watch(memoryOpen, (o) => {
  if (o) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editing.id = 0;
    void nextTick(() => panel.value?.focus({ preventScroll: true }));
  } else {
    const target = opener?.isConnected ? opener : null;
    opener = null;
    void nextTick(() => target?.focus({ preventScroll: true }));
  }
}, { immediate: true });

const close = () => { memoryOpen.value = false; };

async function add() {
  if (!canAdd.value) return;
  draft.busy = true;
  const ok = await ai.addMemory(draft.content.trim(), draft.category, draft.important ? 3 : 2);
  draft.busy = false;
  if (ok) {
    draft.content = '';
    draft.important = false;
    void nextTick(() => input.value?.focus({ preventScroll: true }));
  }
}

function startEdit(m: CoachMemory) {
  Object.assign(editing, { id: m.id, content: m.content, category: m.category, important: m.importance === 3, busy: false });
}

async function saveEdit(m: CoachMemory) {
  if (editing.content.trim().length < 3) return;
  editing.busy = true;
  // Wichtigkeit 1 (vom Coach als "nebensächlich" gemerkt) bleibt, solange "sehr wichtig" nicht angehakt wird
  const importance = editing.important ? 3 : m.importance === 3 ? 2 : m.importance;
  const ok = await ai.updateMemory(m, editing.content.trim(), editing.category, importance);
  editing.busy = false;
  if (ok) editing.id = 0;
}
</script>

<template>
  <transition name="sheet">
      <div v-if="memoryOpen" class="fixed inset-0 z-[80] flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center" @click.self="close" @keydown.esc.stop="close">
          <div v-sheet-drag="close" ref="panel" tabindex="-1" class="glass-panel modal-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl outline-none sm:rounded-3xl"
               role="dialog" aria-modal="true" aria-labelledby="memory-title" data-test="coach-memory">
              <header class="flex items-start justify-between gap-3 px-6 pb-3 pt-6">
                  <div class="min-w-0">
                      <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('ai.kicker') }}</p>
                      <h2 id="memory-title" class="display mt-1 break-words text-2xl text-white">{{ t('ai.memory.title') }}</h2>
                      <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ t('ai.memory.intro') }}</p>
                  </div>
                  <button type="button" @click="close" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white" :aria-label="t('common.close')">✕</button>
              </header>

              <div class="flex-1 overflow-y-auto px-6 pb-4">
                  <!-- Selbst eintragen -->
                  <form class="rounded-2xl border border-white/10 bg-white/[0.03] p-3" @submit.prevent="add" data-test="memory-add">
                      <label class="sr-only" for="memory-new">{{ t('ai.memory.placeholder') }}</label>
                      <textarea id="memory-new" ref="input" v-model="draft.content" rows="2" maxlength="300" :placeholder="t('ai.memory.placeholder')"
                                class="cyber-input w-full resize-none rounded-xl p-3 text-base" data-test="memory-input" @keydown.enter.exact.prevent="add"></textarea>
                      <div class="mt-2 flex flex-wrap items-center gap-2">
                          <label class="sr-only" for="memory-category">{{ t('ai.memory.category') }}</label>
                          <select id="memory-category" v-model="draft.category" class="cyber-input min-h-[2.75rem] min-w-0 flex-1 rounded-xl px-3 text-sm" data-test="memory-category">
                              <option v-for="c in MEMORY_CATEGORIES" :key="c" :value="c">{{ t(`ai.memory.categories.${c}`) }}</option>
                          </select>
                          <button type="button" :aria-pressed="draft.important" @click="draft.important = !draft.important"
                                  class="min-h-[2.75rem]" :class="draft.important ? 'chip chip-active' : 'chip chip-idle'">{{ t('ai.memory.importantToggle') }}</button>
                          <button type="submit" :disabled="!canAdd" class="btn-primary min-h-[2.75rem] rounded-xl px-4 text-sm" data-test="memory-submit">{{ t('ai.memory.add') }}</button>
                      </div>
                  </form>

                  <p v-if="!memory.length && !memoryLoading" class="mt-5 text-sm leading-relaxed text-slate-300" data-test="memory-empty">{{ t('ai.memory.empty') }}</p>

                  <section v-for="g in groups" :key="g.category" class="mt-5" :data-category="g.category">
                      <h3 class="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-label" :class="tone[g.category]">
                          <MemoryIcon :category="g.category" class="h-4 w-4" />
                          {{ t(`ai.memory.categories.${g.category}`) }}
                          <span class="font-mono text-slate-500">{{ g.items.length }}</span>
                      </h3>
                      <ul class="space-y-2">
                          <li v-for="m in g.items" :key="m.id" class="memory-item rounded-xl border border-white/5 bg-black/20 py-2.5 pl-3 pr-1" :data-memory="m.id">
                              <form v-if="editing.id === m.id" class="pr-2" @submit.prevent="saveEdit(m)">
                                  <label class="sr-only" :for="`memory-edit-${m.id}`">{{ t('ai.memory.edit') }}</label>
                                  <textarea :id="`memory-edit-${m.id}`" v-model="editing.content" rows="3" maxlength="300" class="cyber-input w-full resize-none rounded-xl p-2.5 text-sm" data-test="memory-edit-input"></textarea>
                                  <div class="mt-2 flex flex-wrap items-center gap-2">
                                      <select v-model="editing.category" class="cyber-input min-h-[2.75rem] min-w-0 flex-1 rounded-xl px-3 text-sm" :aria-label="t('ai.memory.category')">
                                          <option v-for="c in MEMORY_CATEGORIES" :key="c" :value="c">{{ t(`ai.memory.categories.${c}`) }}</option>
                                      </select>
                                      <button type="button" :aria-pressed="editing.important" @click="editing.important = !editing.important"
                                              class="min-h-[2.75rem]" :class="editing.important ? 'chip chip-active' : 'chip chip-idle'">{{ t('ai.memory.importantToggle') }}</button>
                                  </div>
                                  <div class="mt-2 grid grid-cols-2 gap-2">
                                      <button type="button" class="btn-ghost min-h-[2.75rem] rounded-xl text-sm" @click="editing.id = 0">{{ t('ai.memory.cancel') }}</button>
                                      <button type="submit" :disabled="editing.busy || editing.content.trim().length < 3" class="btn-primary min-h-[2.75rem] rounded-xl text-sm" data-test="memory-edit-save">{{ t('ai.memory.save') }}</button>
                                  </div>
                              </form>
                              <div v-else class="flex items-start gap-1">
                                  <div class="min-w-0 flex-1 py-1">
                                      <p class="break-words text-sm leading-snug text-slate-100">{{ m.content }}</p>
                                      <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-slate-400">
                                          <span v-if="m.importance === 3" class="rounded-full border border-red-400/50 px-1.5 py-px font-sans font-bold uppercase text-red-300 tracking-label">{{ t('ai.memory.critical') }}</span>
                                          <span>{{ t(`ai.memory.by.${m.source}`) }} · {{ day(m.updatedAt) }}</span>
                                          <span v-if="m.expiresAt" class="text-orange-300">{{ t('ai.memory.until', { date: day(m.expiresAt) }) }}</span>
                                      </p>
                                  </div>
                                  <button type="button" @click="startEdit(m)" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
                                          :aria-label="t('ai.memory.editLabel', { text: m.content })" data-test="memory-edit">
                                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>
                                  </button>
                                  <button type="button" @click="ai.forgetMemory(m.id)" class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-300"
                                          :aria-label="t('ai.memory.deleteLabel', { text: m.content })" data-test="memory-delete">
                                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
                                  </button>
                              </div>
                          </li>
                      </ul>
                  </section>
              </div>

              <footer class="border-t border-white/5 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <p class="mb-2 text-[11px] leading-snug text-slate-500">{{ t('ai.memory.privacy') }}</p>
                  <HoldButton v-if="memory.length" :label="t('ai.memory.clear')" @confirm="ai.clearMemory({ confirmed: true })" @fallback="ai.clearMemory()"
                              class="min-h-[2.75rem] w-full rounded-xl border border-white/10 px-4 text-[11px] font-bold uppercase text-slate-400 tracking-label hover:text-red-300" data-test="memory-clear" />
              </footer>
          </div>
      </div>
  </transition>
</template>
