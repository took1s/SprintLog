<script setup lang="ts">
// Notiz zu einer Übung dieser Einheit - oder auslassen mit Grund. Der Coach liest beides (z. B. "Schmerzen" ->
// sichere Alternative statt "nächstes Mal mehr Gewicht"); im Verlauf steht es unter der Übung.
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { vSheetDrag } from '@/lib/gestures';
import type { ExerciseNoteReason } from '@/types';

const app = useAppStore();
const { noteSheetFor, session } = storeToRefs(app);

const REASONS: readonly ExerciseNoteReason[] = ['pain', 'equipment', 'time', 'fatigue', 'other'];
const ex = computed(() => (noteSheetFor.value != null ? app.exerciseFor(noteSheetFor.value) : null));
const note = ref('');
const skipped = ref(false);
const reason = ref<ExerciseNoteReason | null>(null);

watch(noteSheetFor, (id) => {
  if (id == null) return;
  const n = session.value.notes?.[id];
  note.value = n?.note ?? '';
  skipped.value = !!n?.skipped;
  reason.value = n?.reason ?? null;
});

const hasNote = computed(() => noteSheetFor.value != null && !!session.value.notes?.[noteSheetFor.value]);
const canSave = computed(() => !!note.value.trim() || skipped.value || !!reason.value || hasNote.value);

function pickReason(r: ExerciseNoteReason) {
  reason.value = reason.value === r ? null : r;
}
function save() {
  const id = noteSheetFor.value;
  if (id == null) return;
  app.setExerciseNote(id, { note: note.value, skipped: skipped.value, reason: reason.value });
  app.closeNoteSheet();
}
function clear() {
  const id = noteSheetFor.value;
  if (id == null) return;
  app.setExerciseNote(id, { note: null, skipped: false, reason: null });
  if (session.value.done?.includes(id) && !session.value.sets.some((s) => s.exerciseId === id)) app.reopenBlock(id);
  app.closeNoteSheet();
}
</script>

<template>
  <Teleport to="body">
    <transition name="sheet">
      <div v-if="ex" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center" @click.self="app.closeNoteSheet()" @keydown.esc.stop="app.closeNoteSheet()" data-test="note-sheet">
        <form v-sheet-drag="() => app.closeNoteSheet()" class="glass-panel modal-panel w-full max-w-md overflow-hidden rounded-t-3xl px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:rounded-3xl"
              role="dialog" aria-modal="true" aria-labelledby="note-title" @submit.prevent="save">
          <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('exnote.title') }}</p>
          <h2 id="note-title" class="display truncate text-xl text-white">{{ exerciseName(ex) }}</h2>

          <label class="mt-4 block text-[10px] font-bold uppercase text-slate-400 tracking-label" for="exnote-text">{{ t('exnote.note') }}</label>
          <textarea id="exnote-text" v-model="note" rows="2" maxlength="200" :placeholder="t('exnote.placeholder')"
                    class="cyber-input mt-1.5 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none" data-test="exnote-text"></textarea>

          <label class="mt-4 flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <input v-model="skipped" type="checkbox" class="h-5 w-5 flex-shrink-0" data-test="exnote-skip" />
            <span class="min-w-0">
              <span class="block text-sm font-bold text-white">{{ t('exnote.skip') }}</span>
              <span class="block text-[11px] leading-snug text-slate-400">{{ t('exnote.skipHint') }}</span>
            </span>
          </label>

          <p class="mt-4 text-[10px] font-bold uppercase text-slate-400 tracking-label" id="exnote-reason">{{ t('exnote.reason') }}</p>
          <div class="mt-1.5 flex flex-wrap gap-2" role="group" aria-labelledby="exnote-reason">
            <button v-for="r in REASONS" :key="r" type="button" class="chip" :class="reason === r ? 'chip-active' : 'chip-idle'"
                    :aria-pressed="reason === r" @click="pickReason(r)" :data-reason="r">{{ t(`exnote.reasons.${r}`) }}</button>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-2">
            <button type="button" class="btn-ghost rounded-xl py-3 text-sm" :disabled="!hasNote" @click="clear">{{ t('exnote.clear') }}</button>
            <button type="submit" class="btn-primary rounded-xl py-3 text-sm" :disabled="!canSave" data-test="exnote-save">{{ t('exnote.save') }}</button>
          </div>
        </form>
      </div>
    </transition>
  </Teleport>
</template>
