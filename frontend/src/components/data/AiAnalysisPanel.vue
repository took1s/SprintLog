<script setup lang="ts">
// KI-Analyse: strukturierter Bericht (Gesamt oder Woche) mit Status je Bereich, Top-Empfehlungen und Wochenfokus.
// Der letzte Bericht bleibt lokal gespeichert; "Mit dem Coach besprechen" öffnet den Chat im gründlichen Modus.
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { useAiStore } from '@/stores/ai';
import { useAppStore } from '@/stores/app';

const ai = useAiStore();
const { analysis, analysisBusy, analysisError, status, profileFilled } = storeToRefs(ai);
const { online, allWorkouts } = storeToRefs(useAppStore());

const STATUS = {
  good: { dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-400/30' },
  watch: { dot: 'bg-orange-400', text: 'text-orange-300', border: 'border-orange-400/30' },
  risk: { dot: 'bg-red-400', text: 'text-red-300', border: 'border-red-400/40' },
} as const;
const statusKey = (s: string): keyof typeof STATUS => (s in STATUS ? (s as keyof typeof STATUS) : 'watch');
const tone = (s: string) => STATUS[statusKey(s)];

const report = computed(() => analysis.value?.report ?? null);
const canRun = computed(() => online.value && !analysisBusy.value && (!status.value || status.value.remaining >= ai.cost('analysis')));
const stamp = computed(() => analysis.value
  ? t('ai.analysis.generated', { period: t(`ai.analysis.periods.${analysis.value.period}`), date: formatDate(analysis.value.generatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
  : '');

const discuss = () => { void ai.askFromElsewhere(t('ai.analysis.discussQuestion'), 'deep'); };
</script>

<template>
  <section class="space-y-4" data-test="ai-analysis" :aria-busy="!!analysisBusy">
      <div class="glass-panel rounded-2xl p-5">
          <div class="flex items-start gap-3">
              <svg class="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9L19 15z"/></svg>
              <div class="min-w-0">
                  <h2 class="display text-xl text-white">{{ t('ai.analysis.title') }}</h2>
                  <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ t('ai.analysis.intro') }}</p>
              </div>
          </div>
          <button v-if="!profileFilled" type="button" @click="ai.openProfile()" class="mt-3 min-h-[2.75rem] w-full rounded-xl border border-accent/40 bg-accent/5 px-3 text-left text-sm text-slate-200">{{ t('ai.profile.hint') }}</button>
          <p v-if="allWorkouts.length < 3" class="mt-3 text-xs text-orange-300">{{ t('ai.analysis.noData') }}</p>

          <div class="mt-4 grid grid-cols-2 gap-2">
              <button v-for="p in (['full', 'week'] as const)" :key="p" type="button" @click="ai.runAnalysis(p)" :disabled="!canRun" :aria-busy="analysisBusy === p"
                      class="flex min-h-[3.5rem] flex-col items-center justify-center rounded-xl px-2 py-2 text-sm font-bold" :class="p === 'full' ? 'btn-primary' : 'btn-secondary'" :data-test="`ai-analysis-${p}`">
                  <span class="flex items-center gap-2">
                      <span v-if="analysisBusy === p" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
                      {{ p === 'full' ? t('ai.analysis.runFull') : t('ai.analysis.runWeek') }}
                  </span>
                  <span class="text-[10px] font-normal opacity-80">{{ p === 'full' ? t('ai.analysis.fullHint') : t('ai.analysis.weekHint') }}</span>
              </button>
          </div>
          <p v-if="analysisBusy" class="mt-3 text-center text-xs text-slate-300" role="status">{{ t('ai.analysis.running') }}</p>
          <p v-if="analysisError" class="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert" :data-error="analysisError">{{ t(`ai.errors.${analysisError}`) }}</p>
      </div>

      <template v-if="report">
          <article class="glass-panel rounded-2xl p-5" data-test="ai-report">
              <p class="font-mono text-[10px] uppercase text-slate-400 tracking-label">{{ stamp }}</p>
              <h3 class="mt-1 break-words text-lg font-bold leading-snug text-white" data-test="ai-report-headline">{{ report.headline }}</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-200">{{ report.summary }}</p>
          </article>

          <ul class="grid gap-3 sm:grid-cols-2">
              <li v-for="(sec, i) in report.sections" :key="i" class="glass-panel rounded-2xl border p-4" :class="tone(sec.status).border" :data-status="sec.status">
                  <div class="flex items-center justify-between gap-2">
                      <h4 class="break-words font-bold text-white">{{ sec.title }}</h4>
                      <span class="flex flex-shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-label" :class="tone(sec.status).text">
                          <span class="h-2 w-2 rounded-full" :class="tone(sec.status).dot" aria-hidden="true"></span>{{ t(`ai.analysis.status.${statusKey(sec.status)}`) }}
                      </span>
                  </div>
                  <ul class="mt-2 space-y-1.5">
                      <li v-for="(pt, j) in sec.points" :key="j" class="flex gap-2 text-sm leading-snug text-slate-200"><span class="text-slate-500" aria-hidden="true">–</span><span class="min-w-0 break-words">{{ pt }}</span></li>
                  </ul>
              </li>
          </ul>

          <section class="glass-panel rounded-2xl p-5" aria-labelledby="ai-recs">
              <h4 id="ai-recs" class="label-xs text-accent">{{ t('ai.analysis.recommendations') }}</h4>
              <ol class="mt-3 space-y-4">
                  <li v-for="(rec, i) in report.recommendations" :key="i" class="flex gap-3">
                      <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent font-mono text-sm font-black text-on-accent" aria-hidden="true">{{ i + 1 }}</span>
                      <div class="min-w-0">
                          <p class="break-words font-bold text-white">{{ rec.title }}</p>
                          <p class="mt-0.5 text-sm leading-snug text-slate-300">{{ rec.why }}</p>
                          <p class="mt-1 text-sm font-bold leading-snug text-slate-100">→ {{ rec.action }}</p>
                      </div>
                  </li>
              </ol>
              <div class="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p class="label-xs">{{ t('ai.analysis.focus') }}</p>
                  <p class="mt-1 text-sm leading-relaxed text-white">{{ report.nextWeekFocus }}</p>
              </div>
              <button type="button" @click="discuss" :disabled="!online" class="btn-secondary mt-4 min-h-[2.75rem] w-full rounded-xl text-sm" data-test="ai-discuss">{{ t('ai.analysis.discuss') }}</button>
          </section>
          <p class="px-1 text-[11px] leading-relaxed text-slate-400">{{ t('ai.disclaimer') }}</p>
      </template>
  </section>
</template>
