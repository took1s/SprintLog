<script setup lang="ts">
// Vorbereitung: Bereitschaft (Spieltag-Phase, Belastung der letzten 24 h, Schlaf), Tests wählen, Zeitmessung,
// Aufwärmen, Dauer und Material. Gleicher Ausdauertest wie beim letzten Mal ist vorausgewählt (Vergleichbarkeit).
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t, tn } from '@/i18n';
import { useAppStore } from '@/stores/app';
import { useAthleteStore } from '@/stores/athlete';
import { mdLabel } from '@/lib/matchDay';
import { BLOCKS, HAND_CORRECTION, blocksFor, equipmentFor, plannedMinutes, warmupFor, type BlockId, type Endurance, type Timing } from '@/lib/testDay';

const emit = defineEmits<{ (e: 'start', blocks: BlockId[], timing: Timing, warmup: boolean): void }>();
const app = useAppStore();
const athlete = useAthleteStore();
const { tests, todayLog, today } = storeToRefs(athlete);

const lastEndurance = computed<Endurance>(() => {
  const last = [...tests.value].filter((r) => (r.test === 'yoyo' || r.test === 'ift') && r.pending !== 'delete').sort((a, b) => a.day.localeCompare(b.day)).pop();
  return (last?.test as Endurance | undefined) ?? 'yoyo';
});

const picked = ref<BlockId[]>(['cmj', 'sprint', 'agility']);
const endurance = ref<Endurance | 'none'>(lastEndurance.value);
const timing = ref<Timing>('electronic');
const warmup = ref(true);

const blocks = computed(() => blocksFor([...picked.value, ...(endurance.value === 'none' ? [] : [endurance.value])]));
const minutes = computed(() => plannedMinutes(blocks.value, warmup.value));
const gear = computed(() => equipmentFor(blocks.value, timing.value));
const timed = computed(() => blocks.value.some((b) => b === 'sprint' || b === 'agility'));

function toggle(b: BlockId) {
  picked.value = picked.value.includes(b) ? picked.value.filter((x) => x !== b) : [...picked.value, b];
}

/** Hinweise zur Bereitschaft - Tests sind nur vergleichbar, wenn man frisch ist. */
const warnings = computed(() => {
  const out: string[] = [];
  const md = mdLabel(today.value, app.activeProgram);
  if (md === 'MD' || md === 'MD+1' || md === 'MD-1') out.push(t('testDay.warn.md', { label: md }));
  const dayAgo = Date.now() - 24 * 3600_000;
  if (app.allWorkouts.some((w) => new Date(w.date).getTime() > dayAgo && (w.workoutType === 'Match' || (w.sessionRpe ?? 0) >= 8))) out.push(t('testDay.warn.recent'));
  const sleep = todayLog.value?.sleepMinutes;
  if (sleep != null && sleep < 360) out.push(t('testDay.warn.sleep'));
  return out;
});
</script>

<template>
  <div class="flex flex-1 flex-col overflow-hidden" data-test="test-day-setup">
      <div class="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          <h2 class="display text-3xl leading-tight text-white">{{ t('testDay.setupTitle') }}</h2>
          <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ t('testDay.intro') }}</p>

          <!-- Bereitschaft -->
          <div class="mt-4 rounded-2xl border p-3" :class="warnings.length ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-emerald-400/25 bg-emerald-400/[0.05]'" data-test="test-day-readiness">
              <p class="text-tiny font-bold caps tracking-label" :class="warnings.length ? 'text-amber-300' : 'text-emerald-300'">{{ t('testDay.readiness') }}</p>
              <ul v-if="warnings.length" class="mt-1 space-y-1 text-xs leading-snug text-slate-200">
                  <li v-for="w in warnings" :key="w">{{ w }}</li>
              </ul>
              <p v-else class="mt-1 text-xs leading-snug text-slate-200">{{ t('testDay.ready') }}</p>
              <p class="mt-2 text-[11px] leading-snug text-slate-400">{{ t('testDay.standard') }}</p>
          </div>

          <!-- Tests -->
          <p class="label-xs mb-2 mt-5">{{ t('testDay.pick') }}</p>
          <div class="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
              <button v-for="b in (['cmj', 'sprint', 'agility'] as BlockId[])" :key="b" type="button" class="td-choice" :class="{ 'is-on': picked.includes(b) }" :aria-pressed="picked.includes(b)" :data-pick="b" @click="toggle(b)">
                  <span class="block text-sm font-bold">{{ t(`testDay.blocks.${b}`) }}</span>
                  <span class="block text-[11px] text-slate-400">{{ tn('testDay.attempts', BLOCKS[b].attempts) }}</span>
              </button>
          </div>
          <p class="label-xs mb-2 mt-4">{{ t('testDay.endurance') }}</p>
          <div class="grid grid-cols-3 gap-2" role="radiogroup" :aria-label="t('testDay.endurance')">
              <button v-for="e in (['yoyo', 'ift', 'none'] as const)" :key="e" type="button" role="radio" class="td-choice" :class="{ 'is-on': endurance === e }" :aria-checked="endurance === e" :data-endurance="e" @click="endurance = e">
                  <span class="block text-sm font-bold">{{ e === 'none' ? t('testDay.none') : t(`testDay.blocks.${e}`) }}</span>
                  <span v-if="e !== 'none'" class="block text-[11px] text-slate-400">≈{{ BLOCKS[e].minutes }} {{ t('testDay.min') }}</span>
              </button>
          </div>
          <p v-if="endurance !== 'none' && endurance !== lastEndurance && tests.some((r) => r.test === lastEndurance)" class="mt-1.5 text-[11px] text-amber-300">{{ t('testDay.switchEndurance') }}</p>

          <!-- Zeitmessung -->
          <template v-if="timed">
              <p class="label-xs mb-2 mt-5">{{ t('testDay.timing') }}</p>
              <div class="space-y-2" role="radiogroup" :aria-label="t('testDay.timing')">
                  <button type="button" role="radio" class="td-choice w-full text-left" :class="{ 'is-on': timing === 'electronic' }" :aria-checked="timing === 'electronic'" data-timing="electronic" @click="timing = 'electronic'">
                      <span class="block text-sm font-bold">{{ t('testDay.timingElectronic') }}</span>
                      <span class="block text-[11px] leading-snug text-slate-400">{{ t('testDay.timingElectronicHint') }}</span>
                  </button>
                  <button type="button" role="radio" class="td-choice w-full text-left" :class="{ 'is-on': timing === 'stopwatch' }" :aria-checked="timing === 'stopwatch'" data-timing="stopwatch" @click="timing = 'stopwatch'">
                      <span class="block text-sm font-bold">{{ t('testDay.timingStopwatch') }}</span>
                      <span class="block text-[11px] leading-snug text-slate-400">{{ t('testDay.timingStopwatchHint', { n: HAND_CORRECTION }) }}</span>
                  </button>
              </div>
          </template>

          <!-- Aufwärmen -->
          <label v-if="warmupFor(blocks).length" class="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span>
                  <span class="block text-sm font-bold text-white">{{ t('testDay.warmup') }}</span>
                  <span class="block text-[11px] text-slate-400">{{ t('testDay.warmupHint') }}</span>
              </span>
              <input v-model="warmup" type="checkbox" class="h-5 w-5 flex-shrink-0 accent-[var(--c-accent)]" data-test="test-day-warmup-toggle">
          </label>

          <!-- Dauer und Material -->
          <div v-if="blocks.length" class="mt-4 rounded-2xl bg-white/[0.04] p-3 text-xs leading-relaxed text-slate-300" data-test="test-day-plan">
              <p><span class="font-bold text-white">≈ {{ minutes }} {{ t('testDay.min') }}</span> · {{ blocks.map((b) => t(`testDay.blocks.${b}`)).join(' → ') }}</p>
              <p class="mt-1 text-slate-400">{{ t('testDay.equipment') }}: {{ tn('testDay.cones', gear.cones) }}, {{ t('testDay.tape', { n: gear.tape }) }}<template v-if="gear.partner">, {{ t('testDay.partner') }}</template></p>
          </div>
      </div>
      <div class="border-t border-white/10 px-5 pt-3" :style="{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }">
          <button type="button" class="btn-primary w-full rounded-2xl py-4 text-base" :disabled="!blocks.length" data-test="test-day-start" @click="emit('start', blocks, timing, warmup)">▶ {{ t('testDay.go') }}</button>
      </div>
  </div>
</template>
