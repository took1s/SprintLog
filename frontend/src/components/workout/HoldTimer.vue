<script setup lang="ts">
// Zeit-Übung mit Timer (Planke, Isometrie, Halten): antippen -> 3-2-1 -> läuft -> Signal -> Satz ist geloggt.
// Früher aufhören geht: "Fertig" loggt die gehaltene Zeit, "Abbrechen" verwirft sie.
// Einseitig (Seitstütz): Seite 1, Seitenwechsel mit 5 s Vorlauf, Seite 2 - geloggt wird die Zeit pro Seite.
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { exerciseName } from '@/i18n/content';
import { useAppStore } from '@/stores/app';
import { playRestAlarm, unlockAudio } from '@/lib/feedback';
import { alarmHaptic, setKeepAwake, tap } from '@/lib/native';

const app = useAppStore();
const { holdTimer, settings } = storeToRefs(app);
const { closeHoldTimer, logHold, switchHoldSide } = app;

const now = ref(Date.now());
let tick = 0;
let lastCount = -1;

const ex = computed(() => (holdTimer.value ? app.exerciseFor(holdTimer.value.exerciseId) : null));
/** Sekunden seit Start (ohne Vorlauf, ohne Pausen). */
const elapsed = computed(() => {
  const h = holdTimer.value;
  if (!h) return 0;
  const run = h.pausedAt ?? now.value;
  return Math.max(0, (run - h.startedAt) / 1000 - h.lead - h.pausedMs / 1000);
});
const leadLeft = computed(() => {
  const h = holdTimer.value;
  if (!h) return 0;
  return Math.max(0, h.lead - ((h.pausedAt ?? now.value) - h.startedAt - h.pausedMs) / 1000);
});
const switching = computed(() => holdTimer.value?.side === 2 && leadLeft.value > 0);
const phase = computed(() => {
  const h = holdTimer.value;
  if (!h) return '';
  if (switching.value) return t('hold.switch');
  return leadLeft.value > 0 ? t('hold.getReady') : h.pausedAt ? t('hold.paused') : t('hold.hold');
});
const remaining = computed(() => Math.max(0, (holdTimer.value?.target ?? 0) - elapsed.value));
const progress = computed(() => (holdTimer.value?.target ? Math.min(1, elapsed.value / holdTimer.value.target) : 0));
const clock = computed(() => {
  const s = Math.ceil(leadLeft.value > 0 ? leadLeft.value : remaining.value);
  return leadLeft.value > 0 ? String(s) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

function loop() {
  now.value = Date.now();
  const h = holdTimer.value;
  if (!h || h.pausedAt) return;
  // Vorlauf piepst nicht, aber ein kurzer Tick pro Sekunde in der Hand hilft beim Mitzählen
  const count = Math.ceil(leadLeft.value);
  if (leadLeft.value > 0 && count !== lastCount) { lastCount = count; if (settings.value.vibration) tap(); }
  if (leadLeft.value === 0 && lastCount !== 0) { lastCount = 0; if (settings.value.vibration) tap(); }
  if (remaining.value <= 0) finish(true);
}

watch(holdTimer, (h, old) => {
  clearInterval(tick);
  if (h && !h.pausedAt) {
    if (!old) { unlockAudio(); lastCount = -1; void setKeepAwake(true); }
    tick = window.setInterval(loop, 100);
  }
  if (!h) void setKeepAwake(settings.value.wakeLock && app.sessionActive);
}, { immediate: true });
onBeforeUnmount(() => clearInterval(tick));

function togglePause() {
  const h = holdTimer.value;
  if (!h) return;
  if (h.pausedAt) holdTimer.value = { ...h, pausedMs: h.pausedMs + (Date.now() - h.pausedAt), pausedAt: null };
  else holdTimer.value = { ...h, pausedAt: Date.now() };
}

function finish(complete: boolean) {
  const h = holdTimer.value;
  if (!h) return;
  clearInterval(tick);
  const seconds = complete ? h.target : Math.round(elapsed.value);
  if (h.sides === 2 && h.side === 1) {
    // Seite 1 geschafft (oder früher beendet): Signal, dann dieselbe Zeit auf der anderen Seite
    if (seconds < 1) { closeHoldTimer(); return; }
    if (settings.value.vibration) alarmHaptic();
    playRestAlarm({ sound: settings.value.sound, vibration: false });
    lastCount = -1;
    switchHoldSide(seconds);
    return;
  }
  if (complete) {
    playRestAlarm({ sound: settings.value.sound, vibration: settings.value.vibration });
    if (settings.value.vibration) alarmHaptic();
  }
  // Pro Seite zählt, was beide Seiten geschafft haben
  const perSide = h.firstSide != null ? Math.min(h.firstSide, seconds) : seconds;
  if (perSide >= 1) logHold(h.exerciseId, perSide);
  else closeHoldTimer();
}
</script>

<template>
  <transition name="fade">
      <div v-if="holdTimer && ex" class="fixed inset-0 z-[65] flex flex-col items-center justify-center bg-ink/95 px-6" role="dialog" aria-modal="true" :aria-label="exerciseName(ex)" data-test="hold-timer">
          <!-- Phasenwechsel ansagen (Bereit / Halten / Pause) - nicht jede Sekunde, das wäre für VoiceOver Dauerfeuer -->
          <p class="text-[11px] font-bold uppercase tracking-label" :class="switching ? 'text-yellow-400' : 'text-accent'" aria-live="polite" data-test="hold-phase">{{ phase }}</p>
          <h2 class="display mt-2 max-w-xs break-words text-center text-2xl text-white">{{ exerciseName(ex) }}</h2>
          <!-- Einseitig: welche Seite gerade läuft -->
          <div v-if="holdTimer.sides === 2" class="mt-3 flex items-center gap-2" data-test="hold-side">
              <span v-for="n in 2" :key="n" class="h-1.5 w-10 rounded-full" :class="n < holdTimer.side || (n === holdTimer.side && !switching) ? 'bg-accent' : 'bg-white/15'" aria-hidden="true"></span>
              <span class="ml-1 font-mono text-[11px] text-slate-400">{{ t('hold.side', { n: holdTimer.side }) }}</span>
          </div>

          <div class="relative mt-8 h-64 w-64">
              <svg class="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="5" class="text-white/10" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"
                          :stroke-dasharray="282.74" :stroke-dashoffset="282.74 * (1 - progress)" class="text-accent" />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="font-mono font-black text-white" :class="leadLeft > 0 ? 'text-8xl' : 'text-6xl'" role="timer" data-test="hold-clock">{{ clock }}</span>
                  <span v-if="leadLeft === 0" class="mt-1 font-mono text-xs text-slate-400">{{ t('hold.of', { seconds: holdTimer.target }) }}</span>
              </div>
          </div>

          <div class="mt-10 grid w-full max-w-xs grid-cols-2 gap-3 pb-[env(safe-area-inset-bottom)]">
              <button type="button" @click="togglePause" class="btn-secondary rounded-xl py-4 text-sm">{{ holdTimer.pausedAt ? t('hold.resume') : t('hold.pause') }}</button>
              <button type="button" @click="finish(false)" :disabled="leadLeft > 0" class="btn-primary rounded-xl py-4 text-sm" data-test="hold-done">{{ t('hold.done') }}</button>
              <button type="button" @click="closeHoldTimer" class="col-span-2 min-h-[2.75rem] rounded-xl py-3 text-[11px] font-bold uppercase text-slate-400 hover:text-red-400 tracking-label">{{ t('hold.cancel') }}</button>
          </div>
      </div>
  </transition>
</template>
