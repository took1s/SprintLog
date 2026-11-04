// "Plan für mich": aus wenigen Antworten (Ziel, Tage pro Woche, Spieltag, Erfahrung) die passenden Programme
// auswählen und einen Wochenplan vorschlagen. Bewertet werden die eingebauten, geprüften Vorlagen.

import type { ProgramTemplate } from '../types';
import { bit, suggestTrainingDays } from './schedule';

export type PlanFocus = 'strength' | 'speed' | 'football' | 'muscle' | 'rehab';
export type PlanLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface PlanAnswers {
  focus: PlanFocus;
  daysPerWeek: number;
  /** Wochentag des Spiels (0 = Montag ... 6 = Sonntag) oder null. */
  matchDay: number | null;
  level: PlanLevel;
}

export interface PlanChoice { template: ProgramTemplate; score: number; reasons: ('goal' | 'days' | 'level' | 'football')[] }

const GOAL_OF: Record<PlanFocus, string[]> = {
  strength: ['Strength'],
  speed: ['Speed'],
  football: ['Speed', 'Strength', 'General'],
  muscle: ['Hypertrophy'],
  rehab: ['Rehab'],
};
const LEVELS: PlanLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

export function recommendPlans(templates: readonly ProgramTemplate[], a: PlanAnswers, limit = 3): PlanChoice[] {
  const goals = GOAL_OF[a.focus];
  return templates
    .map((tpl) => {
      const reasons: PlanChoice['reasons'] = [];
      let score = 0;
      const gi = goals.indexOf(tpl.goal);
      if (gi >= 0) { score += 10 - gi * 2; reasons.push('goal'); }
      else if (a.focus === 'rehab') score -= 20; // Reha nur mit Reha-Vorlagen
      if (a.focus !== 'rehab' && tpl.goal === 'Rehab') score -= 20;
      const per = tpl.sessionsPerWeek ?? tpl.days.length;
      const diff = Math.abs(per - a.daysPerWeek);
      score += diff === 0 ? 6 : diff === 1 ? 3 : -2 * diff;
      if (diff <= 1) reasons.push('days');
      const lvl = tpl.level;
      if (lvl === 'All levels' || lvl === a.level) { score += 3; reasons.push('level'); }
      else if (LEVELS.indexOf(lvl as PlanLevel) > LEVELS.indexOf(a.level)) score -= 4; // zu schwer
      if ((a.focus === 'football' || a.focus === 'speed') && tpl.category === 'Football') { score += 3; reasons.push('football'); }
      // Reha in Phasen: mit Phase 1 beginnen
      if (tpl.key.startsWith('hamstring-rehab-') && !tpl.key.endsWith('-1')) score -= 5;
      return { template: tpl, score, reasons };
    })
    .filter((c) => c.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

/** Wochenplan zur Auswahl: Trainingstage verteilt, Spieltag eingetragen. */
export function scheduleFor(a: PlanAnswers): { trainingDays: number; matchDays: number } {
  const matchDays = a.matchDay == null ? 0 : bit(a.matchDay);
  return { trainingDays: suggestTrainingDays(a.daysPerWeek, matchDays), matchDays };
}
