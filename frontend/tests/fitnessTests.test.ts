import { describe, expect, it } from 'vitest';
import { history, rate, testDue, thresholds, type TestResult } from '@/lib/fitnessTests';
import { adjustForMd, mdInfo, mdLabel } from '@/lib/matchDay';
import { bit } from '@/lib/schedule';

describe('Leistungstests: Niveau je Position', () => {
  it('Schwellen verschieben sich mit der Position (Zeiten größer = leichter, Sprung/Ausdauer kleiner = leichter)', () => {
    expect(thresholds('sprint30', null)).toEqual([4.5, 4.32, 4.15, 4.0]);
    expect(thresholds('sprint30', 'winger')).toEqual([4.44, 4.26, 4.09, 3.94]);
    expect(thresholds('yoyo', 'goalkeeper')).toEqual([700, 1100, 1500, 1900]);
    expect(thresholds('yoyo', 'midfielder')).toEqual([1600, 2000, 2400, 2800]);
    expect(thresholds('cmj', 'defender')).toEqual([34.5, 38.5, 41.5, 45.5]);
  });

  it('Niveau, nächste Stufe, Abstand und Skala', () => {
    expect(rate('sprint10', 1.8)).toEqual({ level: 'semi', next: 'pro', gap: 0.04, score: 64 });
    expect(rate('sprint10', 2.1)).toMatchObject({ level: 'below', next: 'amateur', gap: 0.15, score: 0 });
    expect(rate('cmj', 45)).toMatchObject({ level: 'elite', next: null, gap: null, score: 100 });
    expect(rate('yoyo', 2000, 'midfielder')).toMatchObject({ level: 'semi', next: 'pro', gap: 400 });
    expect(rate('yoyo', 2000, 'striker')).toMatchObject({ level: 'semi', gap: 50 });
  });

  it('Verlauf: Veränderung positiv = besser, Bestwert; wieder testen nach 6/8 Wochen', () => {
    const r = (day: string, test: TestResult['test'], value: number): TestResult => ({ clientId: `ft-${day}${test}`, day, test, value, updatedAt: '' });
    const list = [r('2026-09-01', 'sprint30', 4.4), r('2026-10-20', 'sprint30', 4.31), r('2026-10-20', 'cmj', 36), r('2026-09-01', 'cmj', 37)];
    expect(history(list, 'sprint30')).toMatchObject({ change: 0.09, best: { value: 4.31 } });
    expect(history(list, 'cmj')).toMatchObject({ change: -1, best: { value: 37 } });
    expect(testDue([], '2026-11-15').state).toBe('none');
    expect(testDue(list, '2026-11-15')).toMatchObject({ state: 'ok', days: 26, nextDay: '2026-12-01' });
    expect(testDue(list, '2026-12-01').state).toBe('due');
    expect(testDue(list, '2026-12-15').state).toBe('overdue');
  });
});

describe('Match-Day-Phasen', () => {
  // Spiel samstags (2026-11-14 ist ein Samstag)
  const sat = { matchDays: bit(5) };
  it('Woche mit einem Spiel: MD+1, MD+2, dann MD-4 ... MD-1', () => {
    expect(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((d) => mdLabel(d, sat)))
      .toEqual(['MD', 'MD+1', 'MD+2', 'MD-4', 'MD-3', 'MD-2', 'MD-1']);
    expect(mdLabel('2026-11-15', null)).toBeNull();
    // Mi + Sa: Donnerstag nach dem Spiel zuerst Regeneration
    expect(mdLabel('2026-11-12', { matchDays: bit(2) | bit(5) })).toBe('MD+1');
  });

  it('Plan-Tag wird an MD-1 leichter: weniger Sätze, RPE gedeckelt; MD-3 unverändert', () => {
    const t = { sets: 4, targetRpe: 8 };
    expect(adjustForMd(t, mdInfo('2026-11-20', sat))).toEqual({ sets: 2, targetRpe: 6 });
    expect(adjustForMd({ sets: 1, targetRpe: null }, mdInfo('2026-11-15', sat))).toEqual({ sets: 1, targetRpe: null });
    expect(adjustForMd(t, mdInfo('2026-11-18', sat))).toBe(t);
  });
});
