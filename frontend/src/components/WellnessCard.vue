<script setup lang="ts">
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { WELLNESS_FIELDS, readinessLevel } from '@/lib/wellness';
import { formatDate } from '@/lib/format';

const app = useAppStore();
const { checkIn, readinessDays, readinessHint, readinessToday, readinessWeek, todayWellness } = storeToRefs(app);
const { openCheckIn, saveCheckIn, setWellnessValue } = app;

const tone = (value: number | null) => ({ good: 'text-emerald-300', ok: 'text-yellow-300', low: 'text-red-300' } as const)[readinessLevel(value) ?? 'ok'];
const bar = (value: number | null) => ({ good: 'bg-emerald-400', ok: 'bg-yellow-400', low: 'bg-red-400' } as const)[readinessLevel(value) ?? 'ok'];
</script>

<template>
  <div class="glass-panel rounded-3xl p-5" data-test="wellness-card">
      <div class="mb-3 flex items-start justify-between gap-3">
          <div>
              <h3 class="display text-white">{{ t('wellness.title') }}</h3>
              <p class="font-mono text-[10px] text-slate-500">{{ t('wellness.subtitle') }}</p>
          </div>
          <div v-if="readinessToday != null" class="text-right">
              <div class="font-mono text-2xl font-black" :class="tone(readinessToday)" data-test="readiness">{{ readinessToday }}%</div>
              <div class="stat-label">{{ t('wellness.readiness') }}</div>
          </div>
      </div>

      <!-- Formular -->
      <div v-if="checkIn.open" class="space-y-3">
          <div v-for="field in WELLNESS_FIELDS" :key="field">
              <div class="mb-1 flex items-baseline justify-between">
                  <span class="label-xs">{{ t(`wellness.fields.${field}`) }}</span>
                  <span class="font-mono text-[9px] text-slate-500">1 = {{ t(`wellness.low.${field}`) }} · 5 = {{ t(`wellness.high.${field}`) }}</span>
              </div>
              <div class="grid grid-cols-5 gap-1.5" role="radiogroup" :aria-label="t(`wellness.fields.${field}`)">
                  <button v-for="n in 5" :key="n" type="button" role="radio" :aria-checked="checkIn[field] === n" @click="setWellnessValue(field, n)" :data-wellness="`${field}-${n}`"
                          class="rounded-lg border py-2 font-mono text-sm font-black transition-all"
                          :class="checkIn[field] === n ? 'border-accent/70 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ n }}</button>
              </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
              <label class="block"><span class="label-xs mb-1">{{ t('wellness.sleepHours') }}</span>
                  <input v-model.number="checkIn.sleepHours" type="number" min="0" max="24" step="0.5" inputmode="decimal" class="cyber-input w-full rounded-xl p-2.5 text-sm" placeholder="8"></label>
              <label class="col-span-2 block"><span class="label-xs mb-1">{{ t('wellness.note') }}</span>
                  <input v-model="checkIn.note" maxlength="200" class="cyber-input w-full rounded-xl p-2.5 text-sm" :placeholder="t('wellness.notePlaceholder')"></label>
          </div>
          <div class="flex gap-2">
              <button type="button" @click="checkIn.open = false" class="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-400 hover:text-white">{{ t('common.cancel') }}</button>
              <button type="button" @click="saveCheckIn" class="cyber-btn flex-1 rounded-xl py-3 text-sm font-bold">{{ t('wellness.save') }}</button>
          </div>
      </div>

      <template v-else>
          <p class="mb-3 text-xs text-slate-300">{{ t(`wellness.advice.${readinessHint}`) }}</p>
          <!-- 14-Tage-Verlauf -->
          <div class="mb-1 flex h-10 items-end gap-1" :aria-label="t('wellness.trend')">
              <div v-for="d in readinessDays" :key="d.date" class="flex-1 rounded-sm" :title="`${formatDate(d.date, { day: '2-digit', month: 'short' })}${d.value != null ? `: ${d.value}%` : ''}`"
                   :class="d.value == null ? 'bg-white/5' : bar(d.value)" :style="{ height: d.value == null ? '12%' : Math.max(12, d.value) + '%' }"></div>
          </div>
          <div class="mb-3 flex justify-between font-mono text-[9px] text-slate-500">
              <span>{{ t('wellness.trend') }}</span>
              <span v-if="readinessWeek != null">{{ t('wellness.week') }}: {{ readinessWeek }}%</span>
          </div>
          <button type="button" @click="openCheckIn" class="w-full rounded-xl py-2.5 text-xs font-bold" :class="todayWellness ? 'cyber-outline-btn' : 'cyber-btn'" data-test="check-in">
              {{ todayWellness ? t('wellness.update') : t('wellness.checkIn') }}
          </button>
      </template>
  </div>
</template>
