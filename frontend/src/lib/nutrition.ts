// Ernährung kompakt: Eiweiß-Schnellwahl typischer Portionen (Richtwerte aus Nährwerttabellen) und Gewichtstrend
// (Wochenrate aus dem 7-Tage-Mittel - Tagesschwankungen von 1-2 kg durch Wasser/Essen fallen so heraus).
import { addDays } from './routines';

export interface FoodPreset { id: 'shake' | 'chicken' | 'quark' | 'skyr' | 'eggs' | 'tuna' | 'meat' | 'milk'; grams: number }

/** Eiweiß je Portion (gerundet): Shake 30 g Pulver, Hähnchen 150 g, Magerquark 250 g, Skyr 150 g, 2 Eier, Thunfisch-Dose, Fleisch/Fisch 150 g, Milch 300 ml. */
export const FOODS: readonly FoodPreset[] = [
  { id: 'shake', grams: 24 },
  { id: 'chicken', grams: 45 },
  { id: 'quark', grams: 30 },
  { id: 'skyr', grams: 17 },
  { id: 'eggs', grams: 13 },
  { id: 'tuna', grams: 28 },
  { id: 'meat', grams: 33 },
  { id: 'milk', grams: 10 },
];

/** Typische Eiweiß-Mahlzeit (~0,4 g/kg, meist 25-40 g) - für "noch ~N Mahlzeiten". */
export const MEAL_PROTEIN = 30;

export interface WeightLog { day: string; weightKg?: number | null }

/** 7-Tage-Mittel an einem Tag (null, wenn in der Woche nichts gewogen). */
export function avgAt(logs: readonly WeightLog[], day: string): number | null {
  const vals: number[] = [];
  for (let k = 0; k < 7; k++) { const w = logs.find((l) => l.day === addDays(day, -k))?.weightKg; if (w != null) vals.push(w); }
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}

/**
 * Veränderung pro Woche (kg): 7-Tage-Mittel heute gegen vor 7 Tagen. Braucht in beiden Wochen mindestens 3 Messungen,
 * sonst null (zu wenig für eine Aussage).
 */
export function weeklyRate(logs: readonly WeightLog[], today: string): number | null {
  const count = (end: string) => Array.from({ length: 7 }, (_, k) => logs.find((l) => l.day === addDays(end, -k))?.weightKg).filter((w) => w != null).length;
  if (count(today) < 3 || count(addDays(today, -7)) < 3) return null;
  const now = avgAt(logs, today), then = avgAt(logs, addDays(today, -7));
  return now != null && then != null ? Math.round((now - then) * 10) / 10 : null;
}

/** Einordnung der Wochenrate: stabil (±0,2 kg), Aufbau, Abnahme, zu schnell (> 1 % Körpergewicht pro Woche). */
export function rateTone(rate: number | null, weight: number | null): 'stable' | 'gain' | 'loss' | 'fast' | null {
  if (rate == null) return null;
  if (weight && Math.abs(rate) > weight * 0.01) return 'fast';
  if (Math.abs(rate) <= 0.2) return 'stable';
  return rate > 0 ? 'gain' : 'loss';
}

/** Noch fehlendes Eiweiß und ungefähr wie viele Mahlzeiten das sind. */
export function proteinLeft(today: number, goal: number | null): { grams: number; meals: number } | null {
  if (!goal) return null;
  const grams = Math.max(0, goal - today);
  return { grams, meals: grams ? Math.max(1, Math.round(grams / MEAL_PROTEIN)) : 0 };
}
