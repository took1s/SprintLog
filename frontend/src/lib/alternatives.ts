// Ersatz-Übungen: "Im Plan steht Passspiel, aber ich habe keinen Ball" -> passende Alternativen.
// Bewertung: gleiche Muskelgruppe, gleiche Erfassungsart (Zeit/Strecke/Gewicht), gleiche Kategorie, schon mal gemacht.
// Braucht das Original einen Ball, fallen Ball-Übungen nach hinten (wer ersetzt, hat meist genau den nicht).

import type { Exercise } from '../types';

const BALL = /\b(ball|pass|passing|dribbl\w*|finish\w*|shoot\w*|shot|juggl\w*|header|heading|cross\w*|rondo|first touch|volley)\b/i;
const NOT_A_FOOTBALL = /\b(medicine|swiss|stability|slam|wall ball)\b/i;

/** Braucht die Übung einen Fußball? */
export const needsBall = (e: Pick<Exercise, 'name' | 'category'>): boolean =>
  e.category === 'Football' && BALL.test(e.name) && !NOT_A_FOOTBALL.test(e.name);

export interface Alternative { exercise: Exercise; reasons: ('muscle' | 'tracking' | 'noBall' | 'familiar')[] }

export function alternativesFor(
  original: Exercise,
  all: readonly Exercise[],
  opts: { exclude?: ReadonlySet<number>; used?: (id: number) => number; limit?: number } = {},
): Alternative[] {
  const ball = needsBall(original);
  const tracking = original.trackingType ?? 'WeightReps';
  const scored = all
    .filter((e) => e.id !== original.id && !opts.exclude?.has(e.id))
    .map((e) => {
      const reasons: Alternative['reasons'] = [];
      let score = 0;
      if ((e.muscleGroup || 'Other') === (original.muscleGroup || 'Other')) { score += 4; reasons.push('muscle'); }
      if ((e.trackingType ?? 'WeightReps') === tracking) { score += 3; reasons.push('tracking'); }
      if (e.category === original.category) score += 2;
      if (ball) {
        if (needsBall(e)) score -= 10;
        else reasons.push('noBall');
      }
      const used = opts.used?.(e.id) ?? 0;
      if (used > 0) { score += Math.min(2, used / 5); reasons.push('familiar'); }
      return { exercise: e, reasons, score };
    })
    .filter((x) => x.score >= 5)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
  return scored.slice(0, opts.limit ?? 8).map(({ exercise, reasons }) => ({ exercise, reasons }));
}
