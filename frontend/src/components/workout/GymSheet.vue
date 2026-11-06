<script setup lang="ts">
// Studio der Einheit wählen: Maschinen und Gewichtsstapel unterscheiden sich, deshalb gelten Rekorde und
// "letztes Mal" an Maschinen pro Studio. Liste pflegen (hinzufügen, Hauptstudio, entfernen) direkt hier.
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { gymKey } from '@/lib/liveWorkout';
import { vSheetDrag } from '@/lib/gestures';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const app = useAppStore();
const { gyms, mainGym, sessionGym } = storeToRefs(app);

const draft = ref('');
const editing = ref(false);

function choose(name: string | null) {
  app.setSessionGym(name);
  emit('close');
}
function add() {
  const name = draft.value.trim();
  if (!name) return;
  if (app.addGym(name)) {
    draft.value = '';
    app.setSessionGym(name);
    emit('close');
  }
}
const isCurrent = (g: string | null) => (g === null ? sessionGym.value == null : gymKey(sessionGym.value) === gymKey(g));
</script>

<template>
  <Teleport to="body">
    <transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 sm:items-center" @click.self="emit('close')" @keydown.esc.stop="emit('close')" data-test="gym-sheet">
        <div v-sheet-drag="() => emit('close')" class="glass-panel modal-panel w-full max-w-md overflow-hidden rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="gym-title">
          <div class="px-6 pb-2 pt-6">
            <p class="text-[10px] font-bold uppercase text-accent tracking-label">{{ t('gym.title') }}</p>
            <h2 id="gym-title" class="display text-xl text-white">{{ t('gym.choose') }}</h2>
            <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ t('gym.hint') }}</p>
          </div>

          <ul class="max-h-[45dvh] space-y-1.5 overflow-y-auto px-4 py-2" role="radiogroup" :aria-label="t('gym.choose')">
            <li v-for="g in gyms" :key="g" class="flex items-center gap-2">
              <button type="button" role="radio" :aria-checked="isCurrent(g)" @click="choose(g)" :data-gym="g"
                      class="gym-option flex-1" :class="{ 'is-active': isCurrent(g) }">
                <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
                <span class="min-w-0 flex-1 truncate text-left">{{ g }}</span>
                <span v-if="mainGym && gymKey(g) === gymKey(mainGym)" class="gym-main">{{ t('gym.main') }}</span>
              </button>
              <template v-if="editing">
                <button v-if="gymKey(g) !== gymKey(mainGym)" type="button" class="gym-tool" @click="app.makeMainGym(g)" :aria-label="t('gym.makeMain')">★</button>
                <button type="button" class="gym-tool hover:text-red-400" @click="app.removeGym(g)" :aria-label="t('gym.remove', { name: g })">✕</button>
              </template>
            </li>
            <li>
              <button type="button" role="radio" :aria-checked="isCurrent(null)" @click="choose(null)" class="gym-option w-full text-slate-400" :class="{ 'is-active': isCurrent(null) }">
                <span class="h-4 w-4 flex-shrink-0" aria-hidden="true"></span>
                <span class="flex-1 text-left">{{ t('gym.none') }}</span>
              </button>
            </li>
          </ul>

          <form class="flex gap-2 px-4 pt-2" @submit.prevent="add">
            <label class="sr-only" for="gym-new">{{ t('gym.add') }}</label>
            <input id="gym-new" v-model="draft" maxlength="40" :placeholder="t('gym.placeholder')" autocomplete="off"
                   class="cyber-input min-w-0 flex-1 rounded-xl px-3 py-3 text-sm outline-none" data-test="gym-input" />
            <button type="submit" class="btn-primary flex-shrink-0 rounded-xl px-4 text-sm" :disabled="!draft.trim()" data-test="gym-add">{{ t('gym.add') }}</button>
          </form>
          <div class="flex items-center justify-between gap-3 px-6 pt-3">
            <p class="text-[11px] leading-snug text-slate-500">{{ t('gym.mainHint') }}</p>
            <button v-if="gyms.length" type="button" class="min-h-[2.75rem] flex-shrink-0 rounded-lg px-2 text-[11px] font-bold uppercase text-slate-400 tracking-label hover:text-white" @click="editing = !editing">
              {{ editing ? t('common.done') : t('common.edit') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
