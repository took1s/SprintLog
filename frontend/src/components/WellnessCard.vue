<script setup lang="ts">
import DecimalInput from '@/components/DecimalInput.vue';
import { t } from '@/i18n';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import { WELLNESS_FIELDS, readinessLevel } from '@/lib/wellness';
import { formatDate } from '@/lib/format';

const app = useAppStore();
const { checkIn, checkInDays, missedYesterday, readinessDays, readinessHint, readinessToday, readinessWeek, todayWellness } = storeToRefs(app);
const dayChip = (date: string, isToday: boolean, i: number) => (isToday ? t('wellness.today') : i === 1 ? t('wellness.yesterday') : formatDate(date, { weekday: 'short', day: 'numeric' }));
const { openCheckIn, saveCheckIn, setWellnessValue } = app;

const tone = (value: number | null) => ({ good: 'text-emerald-300', ok: 'text-yellow-300', low: 'text-red-300' } as const)[readinessLevel(value) ?? 'ok'];
// Farbe nur für die Ausreißer: normal = neutral, gut = grün, niedrig = rot (sonst ist die Leiste eine gelbe Wand)
const bar = (value: number | null) => ({ good: 'bg-emerald-400', ok: 'bg-white/30', low: 'bg-red-400' } as const)[readinessLevel(value) ?? 'ok'];
</script>

<template>
  <div class="glass-panel rounded-3xl p-5" data-test="wellness-card">
      <div class="mb-3 flex items-start justify-between gap-3">
          <div>
              <h3 class="display text-white">{{ t('wellness.title') }}</h3>
              <p class="font-mono text-tiny text-slate-500">{{ t('wellness.subtitle') }}</p>
          </div>
          <div v-if="readinessToday != null" class="text-right">
              <div class="font-mono text-2xl font-black" :class="tone(readinessToday)" data-test="readiness">{{ readinessToday }}%</div>
              <div class="stat-label">{{ t('wellness.readiness') }}</div>
          </div>
      </div>

      <!-- Formular -->
      <div v-if="checkIn.open" class="space-y-3">
          <!-- Tag wählen: heute oder nachtragen (letzte 7 Tage); Punkt = schon eingetragen -->
          <div class="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" :aria-label="t('wellness.day')" data-test="check-in-days">
              <button v-for="(d, i) in checkInDays" :key="d.date" type="button" role="radio" :aria-checked="checkIn.date === d.date" :data-day="d.date"
                      class="relative flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors"
                      :class="checkIn.date === d.date ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'"
                      @click="openCheckIn(d.date)">
                  {{ dayChip(d.date, d.isToday, i) }}
                  <span v-if="d.filled" class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true"></span>
                  <span v-if="d.filled" class="sr-only">· {{ t('wellness.filled') }}</span>
              </button>
          </div>
          <div v-for="field in WELLNESS_FIELDS" :key="field">
              <div class="mb-1 flex items-baseline justify-between">
                  <span class="label-xs">{{ t(`wellness.fields.${field}`) }}</span>
                  <span class="font-mono text-micro text-slate-500">1 = {{ t(`wellness.low.${field}`) }} · 5 = {{ t(`wellness.high.${field}`) }}</span>
              </div>
              <div class="grid grid-cols-5 gap-1.5" role="radiogroup" :aria-label="t(`wellness.fields.${field}`)">
                  <button v-for="n in 5" :key="n" type="button" role="radio" :aria-checked="checkIn[field] === n" @click="setWellnessValue(field, n)" :data-wellness="`${field}-${n}`"
                          class="rounded-lg border py-2 font-mono text-sm font-black transition-all"
                          :class="checkIn[field] === n ? 'border-accent/70 bg-accent/15 text-accent' : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'">{{ n }}</button>
              </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
              <label class="block"><span class="label-xs mb-1">{{ t('wellness.sleepHours') }}</span>
                  <DecimalInput v-model="checkIn.sleepHours" class="cyber-input w-full rounded-xl p-2.5 text-sm" placeholder="8" /></label>
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
          <div class="mb-1 flex h-10 items-end gap-1" role="img" :aria-label="t('wellness.trend')">
              <div v-for="d in readinessDays" :key="d.date" class="flex-1 rounded-sm" :title="`${formatDate(d.date, { day: '2-digit', month: 'short' })}${d.value != null ? `: ${d.value}%` : ''}`"
                   :class="d.value == null ? 'bg-white/5' : bar(d.value)" :style="{ height: d.value == null ? '12%' : Math.max(12, d.value) + '%' }"></div>
          </div>
          <div class="mb-3 flex justify-between font-mono text-micro text-slate-500">
              <span>{{ t('wellness.trend') }}</span>
              <span v-if="readinessWeek != null">{{ t('wellness.week') }}: {{ readinessWeek }}%</span>
          </div>
          <button v-if="missedYesterday" type="button" class="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-left text-xs text-amber-200" data-test="check-in-missed" @click="openCheckIn(missedYesterday)">
              <span>{{ t('wellness.missedYesterday') }}</span><span class="font-bold">{{ t('wellness.addNow') }} →</span>
          </button>
          <button type="button" @click="openCheckIn()" class="w-full rounded-xl py-2.5 text-xs font-bold" :class="todayWellness ? 'cyber-outline-btn' : 'cyber-btn'" data-test="check-in">
              {{ todayWellness ? t('wellness.update') : t('wellness.checkIn') }}
          </button>
      </template>
  </div>
</template>
