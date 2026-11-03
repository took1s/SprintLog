// Texte zu Kraft-Zielen (Vorgabe, Prognose) - an einer Stelle, damit Plan-Tab, Info-Seite und Einheit gleich formulieren.
import { t } from '../i18n';
import { formatDate, formatNumber } from './format';
import type { GoalPrescription, GoalProgress, LiftGoal } from './goals';

const kg = (v: number | null | undefined) => formatNumber(v ?? 0, 2);

/** "Testtag: 100 kg × 1", "+2,5 kg: 3×5 @ 82,5 kg" ... */
export function prescriptionLabel(next: GoalPrescription, goal: Pick<LiftGoal, 'increment'>): string {
  const p = { sets: next.sets, reps: next.reps, weight: kg(next.weight), inc: kg(goal.increment) };
  if (next.kind === 'start' && next.weight == null) return t('goals.kinds.startPick', p);
  return t(`goals.kinds.${next.kind}`, p);
}

/** Ziel kurz: "100 kg × 1" */
export const goalTargetLabel = (goal: Pick<LiftGoal, 'targetWeight' | 'targetReps'>): string =>
  goal.targetReps === 1 ? t('goals.labelOneRm', { weight: kg(goal.targetWeight) }) : t('goals.labelReps', { weight: kg(goal.targetWeight), reps: goal.targetReps });

/** Prognose als Satz (Datum aus Trend oder geplanter Steigerung). */
export function etaLabel(progress: GoalProgress): string {
  if (progress.achieved) return t('goals.reached');
  if (progress.current > 0 && progress.current >= progress.target) return t('goals.ready');
  if (!progress.eta) return t('goals.noEta');
  const date = formatDate(progress.eta, { day: '2-digit', month: 'short', year: 'numeric' });
  return progress.etaSource === 'trend' ? t('goals.eta', { date }) : t('goals.etaPlan', { date });
}

/** "Gesch. 1RM 119,6 → 132 kg" */
export const e1rmLabel = (progress: GoalProgress): string =>
  progress.current > 0 ? t('goals.e1rmRange', { current: formatNumber(progress.current, 1), target: formatNumber(progress.target, 1) }) : '';

/** Tempo: "+1,2 kg/Woche" bzw. benötigt bei Wunschdatum. */
export function paceLabel(progress: GoalProgress): string {
  const parts: string[] = [];
  if (progress.trendPerWeek != null) parts.push(t('goals.trend', { value: (progress.trendPerWeek > 0 ? '+' : '') + formatNumber(progress.trendPerWeek, 1) }));
  if (progress.neededPerWeek != null) parts.push(t('goals.needed', { value: formatNumber(progress.neededPerWeek, 1) }));
  return parts.join(' · ');
}
