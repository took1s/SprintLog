import { describe, expect, test } from 'vitest';
import { coachToday, regionsOf, type CoachInput } from '../src/lib/coach';

const base: CoachInput = {
  now: new Date('2026-11-04T17:00:00'), todayKind: 'training', tomorrowKind: 'rest', loadZone: 'optimal', readiness: null,
  recovery: [], daysSinceLast: 2, trainedToday: false, rehab: false, nextDay: 'Lower A', nextDayRegions: ['legs'],
};

describe('coach', () => {
  test('normal training day: train with the next plan day', () => {
    const r = coachToday(base);
    expect(r.kind).toBe('train');
    expect(r.startPlan).toBe(true);
    expect(r.reasons).toContainEqual({ key: 'planNext', day: 'Lower A' });
  });

  test('match today / tomorrow', () => {
    expect(coachToday({ ...base, todayKind: 'match' }).kind).toBe('match');
    const r = coachToday({ ...base, tomorrowKind: 'match' });
    expect(r.kind).toBe('light');
    expect(r.reasons.map((x) => x.key)).toContain('matchTomorrow');
  });

  test('legs not recovered and the plan day is a leg day -> light', () => {
    const r = coachToday({ ...base, recovery: [{ region: 'legs', percent: 40, readyAt: new Date() }] });
    expect(r.kind).toBe('light');
    expect(r.reasons[0]).toMatchObject({ key: 'notRecovered', region: 'legs' });
    // Oberkörper-Tag: Beine stören nicht
    expect(coachToday({ ...base, nextDayRegions: ['upper'], recovery: [{ region: 'legs', percent: 40, readyAt: new Date() }] }).kind).toBe('train');
  });

  test('load danger means rest, low readiness means light, long break gets you moving again', () => {
    expect(coachToday({ ...base, loadZone: 'danger' }).kind).toBe('rest');
    expect(coachToday({ ...base, readiness: 30 }).kind).toBe('light');
    expect(coachToday({ ...base, todayKind: 'rest', daysSinceLast: 5 }).kind).toBe('light');
    expect(coachToday({ ...base, todayKind: 'rest', daysSinceLast: 1 }).kind).toBe('rest');
  });

  test('rehab and already trained', () => {
    expect(coachToday({ ...base, rehab: true }).kind).toBe('rehab');
    expect(coachToday({ ...base, trainedToday: true }).kind).toBe('rest');
  });

  test('main regions of a day', () => {
    expect(regionsOf([{ region: 'legs', sets: 9 }, { region: 'core', sets: 1 }])).toEqual(['legs']);
  });
});
