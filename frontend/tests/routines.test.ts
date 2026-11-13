import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isScheduled, newRoutineId, routineProgress, routineState, scheduledDays, sortRoutines, todaysRoutines, toggleDone, type Routine } from '@/lib/routines';
import { cleanDraft } from '@/stores/routines';

// 2026-11-09 ist ein Montag
const base = (over: Partial<Routine> = {}): Routine => ({
  clientId: 'rt-test0001', title: 'Reha', kind: 'rehab', days: 127, startDate: '2026-11-09', endDate: '2026-11-29', reason: null,
  source: 'coach', steps: [{ name: 'Nordic Curls', dose: '2 x 5', exerciseId: 50 }], doneDates: [], createdAt: '', updatedAt: '', ...over,
});

describe('Routinen: Datum', () => {
  it('rechnet in lokalen Tagen, auch über Monats- und Sommerzeitgrenzen', () => {
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(daysBetween('2026-11-09', '2026-11-29')).toBe(20);
  });
});

describe('Routinen: wann fällig', () => {
  const mwf = base({ days: 0b10101 }); // Mo, Mi, Fr

  it('nur im Zeitraum und an den gewählten Wochentagen', () => {
    expect(isScheduled(mwf, '2026-11-09')).toBe(true);  // Mo
    expect(isScheduled(mwf, '2026-11-10')).toBe(false); // Di
    expect(isScheduled(mwf, '2026-11-08')).toBe(false); // vor Beginn
    expect(isScheduled(mwf, '2026-11-30')).toBe(false); // nach Ende
    expect(scheduledDays(mwf, '2026-11-09', '2026-11-15')).toEqual(['2026-11-09', '2026-11-11', '2026-11-13']);
  });

  it('Zustand: kommend, läuft, beendet', () => {
    expect(routineState(mwf, '2026-11-01')).toBe('upcoming');
    expect(routineState(mwf, '2026-11-29')).toBe('active');
    expect(routineState(mwf, '2026-11-30')).toBe('ended');
    expect(routineState(base({ endDate: null }), '2030-01-01')).toBe('active');
  });

  it('Haken umschalten bleibt sortiert und ohne Duplikate', () => {
    expect(toggleDone(['2026-11-12'], '2026-11-10')).toEqual(['2026-11-10', '2026-11-12']);
    expect(toggleDone(['2026-11-10', '2026-11-12'], '2026-11-10')).toEqual(['2026-11-12']);
  });
});

describe('Routinen: Fortschritt', () => {
  it('erledigt/fällig, Rest-Tage und Serie - heute noch offen bricht die Serie nicht', () => {
    const r = base({ doneDates: ['2026-11-09', '2026-11-11', '2026-11-12'] });
    const p = routineProgress(r, '2026-11-13');
    expect(p).toMatchObject({ state: 'active', due: 5, done: 3, total: 21, daysLeft: 16, streak: 2, dueToday: true, doneToday: false });
    // 10.11. fehlt: 3 von 4 vergangenen fälligen Tagen (heute offen zählt nicht mit)
    expect(p.adherence).toBe(75);
    expect(routineProgress({ ...r, doneDates: [...r.doneDates, '2026-11-13'] }, '2026-11-13').streak).toBe(3);
  });

  it('ohne Ende: keine Gesamtzahl, Erfüllung der letzten 14 Tage', () => {
    const p = routineProgress(base({ endDate: null, days: 0b1, doneDates: ['2026-11-09'] }), '2026-11-20');
    expect(p.total).toBeNull();
    expect(p.daysLeft).toBeNull();
    expect(p.adherence).toBe(50); // Mo 9.11. ja, Mo 16.11. nein
  });

  it('heute: Reha zuerst, sonst nach Name (Haken verschiebt nichts); gelöschte und nicht fällige fehlen', () => {
    const today = '2026-11-13';
    const list = [
      base({ clientId: 'a', title: 'Dehnen', kind: 'mobility' }),
      base({ clientId: 'b', title: 'Reha', doneDates: [today] }),
      base({ clientId: 'c', title: 'Knöchel', kind: 'prevention' }),
      base({ clientId: 'd', title: 'Weg', pending: 'delete' }),
      base({ clientId: 'e', title: 'Dienstags', days: 0b10 }),
      base({ clientId: 'f', title: 'Reha 2' }),
    ];
    expect(todaysRoutines(list, today).map((r) => r.clientId)).toEqual(['b', 'f', 'a', 'c']);
  });

  it('Liste: laufend, kommend, beendet (zuletzt beendete zuerst)', () => {
    const today = '2026-11-13';
    const list = [
      base({ clientId: 'old', endDate: '2026-11-01', startDate: '2026-10-01' }),
      base({ clientId: 'later', startDate: '2026-12-01', endDate: null }),
      base({ clientId: 'now' }),
      base({ clientId: 'old2', endDate: '2026-11-10', startDate: '2026-10-01' }),
    ];
    expect(sortRoutines(list, today).map((r) => r.clientId)).toEqual(['now', 'later', 'old2', 'old']);
  });
});

describe('Routinen: Eingaben', () => {
  it('säubert den Entwurf wie der Server (leere Schritte raus, Ende nicht vor Beginn)', () => {
    const c = cleanDraft({
      title: '  Dehnen  ', kind: 'mobility', days: 0, startDate: '2026-11-13', endDate: '2026-11-01', reason: '   ',
      steps: [{ name: ' Hüftbeuger ', dose: ' 2 x 45 s ' }, { name: '   ', dose: 'x' }],
    });
    expect(c).toEqual({ title: 'Dehnen', kind: 'mobility', days: 127, startDate: '2026-11-13', endDate: null, reason: null, steps: [{ name: 'Hüftbeuger', dose: '2 x 45 s', exerciseId: null }] });
  });

  it('Client-Id passt zum Server-Format', () => {
    const id = newRoutineId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newRoutineId()).not.toBe(id);
  });
});
