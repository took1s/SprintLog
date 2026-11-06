<script setup lang="ts">
// KI-Analyse: strukturierter Bericht (Gesamt oder Woche) mit Status je Bereich, Top-Empfehlungen und Wochenfokus.
// Der letzte Bericht bleibt lokal gespeichert; "Mit dem Coach besprechen" öffnet den Chat im gründlichen Modus.
import { computed, nextTick, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { deviceOnline, useAiStore } from '@/stores/ai';
import { useAppStore } from '@/stores/app';

const ai = useAiStore();
const { analysis, analysisBusy, analysisError, status, profileFilled } = storeToRefs(ai);
const { allWorkouts } = storeToRefs(useAppStore());
const online = deviceOnline;

const STATUS = {
  good: { dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-400/30' },
  watch: { dot: 'bg-orange-400', text: 'text-orange-300', border: 'border-orange-400/30' },
  risk: { dot: 'bg-red-400', text: 'text-red-300', border: 'border-red-400/40' },
} as const;
const statusKey = (s: string): keyof typeof STATUS => (s in STATUS ? (s as keyof typeof STATUS) : 'watch');
const tone = (s: string) => STATUS[statusKey(s)];

const report = computed(() => analysis.value?.report ?? null);
const affordable = computed(() => !status.value || status.value.remaining >= ai.cost('analysis'));
const canRun = computed(() => online.value && !analysisBusy.value && affordable.value);
/** Warum die Knöpfe grau sind (offline / Tageslimit) - sonst wirken sie kaputt. Gleiche Meldung nicht doppelt zeigen. */
const blocked = computed<'offline' | 'ai_quota' | null>(() => {
  const b = !online.value ? 'offline' : !affordable.value ? 'ai_quota' : null;
  return b && b !== analysisError.value ? b : null;
});
const stamp = computed(() => analysis.value
  ? t('ai.analysis.generated', { period: t(`ai.analysis.periods.${analysis.value.period}`), date: formatDate(analysis.value.generatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
  : '');

const discuss = () => { void ai.askFromElsewhere(t('ai.analysis.discussQuestion'), 'deep'); };

/** Neuer Bericht: Überschrift fokussieren - scrollt sie ins Bild und der Screenreader liest das Ergebnis (wie beim KI-Plan). */
const headline = ref<HTMLElement | null>(null);
async function run(period: 'full' | 'week') {
  const before = analysis.value?.generatedAt;
  await ai.runAnalysis(period);
  if (analysis.value && analysis.value.generatedAt !== before) {
    await nextTick();
    headline.value?.focus();
  }
}
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
          <!-- Gleiche Optik wie der Profil-Hinweis im Chat -->
          <button v-if="!profileFilled" type="button" @click="ai.openProfile()" class="mt-4 flex min-h-[2.75rem] w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-left text-sm leading-snug text-slate-200">
              <svg class="h-5 w-5 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path stroke-linecap="round" d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>
              <span>{{ t('ai.profile.hint') }}</span>
          </button>
          <p v-if="allWorkouts.length < 3" class="mt-3 text-xs text-orange-300">{{ t('ai.analysis.noData') }}</p>

          <!-- Untereinander statt nebeneinander: "GESAMTANALYSE" in Versalien passt nicht in eine halbe Kachel (Pitch/Mono) -->
          <div class="mt-4 space-y-2">
              <button v-for="p in (['full', 'week'] as const)" :key="p" type="button" @click="run(p)" :disabled="!canRun" :aria-busy="analysisBusy === p"
                      class="flex min-h-[3.5rem] w-full flex-col items-center justify-center rounded-xl px-3 py-2 text-sm font-bold leading-tight" :class="p === 'full' ? 'btn-primary' : ['btn-secondary', analysisBusy === p ? '' : 'disabled:opacity-50']" :data-test="`ai-analysis-${p}`">
                  <span class="flex items-center gap-2">
                      <span v-if="analysisBusy === p" class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true"></span>
                      {{ p === 'full' ? t('ai.analysis.runFull') : t('ai.analysis.runWeek') }}
                  </span>
                  <!-- normal-case: der Zeitraum ist ein Hinweis, kein Knopftext; volle Deckkraft für 4.5:1 auf der Akzentfläche -->
                  <span class="mt-0.5 text-[11px] font-normal normal-case tracking-normal">{{ p === 'full' ? t('ai.analysis.fullHint') : t('ai.analysis.weekHint') }}</span>
              </button>
          </div>
          <p v-if="blocked" class="mt-3 text-xs leading-snug text-orange-300" data-test="ai-analysis-blocked">{{ t(`ai.errors.${blocked}`) }}</p>
          <p v-if="analysisBusy" class="mt-3 text-center text-xs text-slate-300" aria-hidden="true">{{ t('ai.analysis.running') }}</p>
          <!-- Live-Region bleibt im DOM - erst eingefügte role=status-Elemente werden oft nicht angesagt -->
          <p class="sr-only" role="status">{{ analysisBusy ? t('ai.analysis.running') : '' }}</p>
          <p v-if="analysisError" class="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert" :data-error="analysisError">{{ t(`ai.errors.${analysisError}`) }}</p>
      </div>

      <template v-if="report">
          <article class="glass-panel rounded-2xl p-5" data-test="ai-report">
              <p class="font-mono text-[10px] uppercase text-slate-400 tracking-label">{{ stamp }}</p>
              <h3 ref="headline" tabindex="-1" class="mt-1 break-words text-lg font-bold leading-snug text-white outline-none" data-test="ai-report-headline">{{ report.headline }}</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-200">{{ report.summary }}</p>
          </article>

          <ul class="grid gap-3 sm:grid-cols-2">
              <li v-for="(sec, i) in report.sections" :key="i" class="glass-panel rounded-2xl border p-4" :class="tone(sec.status).border" :data-status="sec.status">
                  <!-- Status gehört in die Überschrift: beim Springen von Überschrift zu Überschrift hört man "Erholung, Handeln" -->
                  <h4 class="flex items-start justify-between gap-2">
                      <span class="min-w-0 break-words font-bold leading-6 text-white">{{ sec.title }}</span>
                      <span class="flex h-6 flex-shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-label" :class="tone(sec.status).text">
                          <span class="h-2 w-2 rounded-full" :class="tone(sec.status).dot" aria-hidden="true"></span><span class="sr-only">, </span>{{ t(`ai.analysis.status.${statusKey(sec.status)}`) }}
                      </span>
                  </h4>
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
                          <p class="mt-1 text-sm font-bold leading-snug text-slate-100"><span aria-hidden="true">→ </span>{{ rec.action }}</p>
                      </div>
                  </li>
              </ol>
              <div class="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p class="label-xs">{{ t('ai.analysis.focus') }}</p>
                  <p class="mt-1 text-sm leading-relaxed text-white">{{ report.nextWeekFocus }}</p>
              </div>
              <button type="button" @click="discuss" :disabled="!online" class="btn-secondary mt-4 min-h-[2.75rem] w-full rounded-xl px-3 py-2 text-sm font-bold leading-tight disabled:opacity-50" data-test="ai-discuss">{{ t('ai.analysis.discuss') }}</button>
          </section>
          <p class="px-1 text-[11px] leading-relaxed text-slate-400">{{ t('ai.disclaimer') }}</p>
      </template>
  </section>
</template>
