import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, doneCount, fillTimes, nextRound, normalizeTimes, painSummary, painTone, setPainLevel, slotOf, suggestedTimes, historyWeeks, isDone, isScheduled, newRoutineId, routineProgress, routineState, scheduledDays, setDoneCount, sortRoutines, tapCount, todaysRoutines, type Routine } from '@/lib/routines';
import { cleanDraft } from '@/stores/routines';

// 2026-11-09 ist ein Montag
const base = (over: Partial<Routine> = {}): Routine => ({
  clientId: 'rt-test0001', title: 'Reha', kind: 'rehab', days: 127, startDate: '2026-11-09', endDate: '2026-11-29', reason: null,
  source: 'coach', steps: [{ name: 'Nordic Curls', dose: '2 x 5', exerciseId: 50 }], timesPerDay: 1, doneDates: [], times: [], pain: [], createdAt: '', updatedAt: '', ...over,
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

  it('Haken: einmal täglich umschalten, mehrmals täglich bis zum k-ten Durchgang', () => {
    const once = base({ doneDates: ['2026-11-12'] });
    expect(setDoneCount(once, '2026-11-10', tapCount(doneCount(once, '2026-11-10'), 1))).toEqual(['2026-11-10', '2026-11-12']);
    expect(setDoneCount(once, '2026-11-12', tapCount(1, 1))).toEqual([]);
    const thrice = base({ timesPerDay: 3, doneDates: ['2026-11-13'] });
    // Tipp auf den 3. Punkt -> 3 von 3; erneuter Tipp darauf -> 2 von 3; nie mehr als vorgesehen
    expect(doneCount({ doneDates: setDoneCount(thrice, '2026-11-13', tapCount(1, 3)) }, '2026-11-13')).toBe(3);
    expect(tapCount(3, 3)).toBe(2);
    expect(setDoneCount(thrice, '2026-11-13', 9).filter((d) => d === '2026-11-13')).toHaveLength(3);
    expect(isDone(thrice, '2026-11-13')).toBe(false);
    expect(isDone({ ...thrice, doneDates: ['2026-11-13', '2026-11-13', '2026-11-13'] }, '2026-11-13')).toBe(true);
  });
});

describe('Routinen: Fortschritt', () => {
  it('erledigt/fällig, Rest-Tage und Serie - heute noch offen bricht die Serie nicht', () => {
    const r = base({ doneDates: ['2026-11-09', '2026-11-11', '2026-11-12'] });
    const p = routineProgress(r, '2026-11-13');
    expect(p).toMatchObject({ state: 'active', due: 5, done: 3, total: 21, daysLeft: 16, streak: 2, dueToday: true, doneToday: false, countToday: 0, missedRecent: '2026-11-10' });
    // 10.11. fehlt: 3 von 4 vergangenen fälligen Tagen (heute offen zählt nicht mit)
    expect(p.adherence).toBe(75);
    expect(routineProgress({ ...r, doneDates: [...r.doneDates, '2026-11-13'] }, '2026-11-13').streak).toBe(3);
  });

  it('mehrmals täglich: ein Tag zählt erst mit allen Durchgängen', () => {
    const r = base({ timesPerDay: 2, doneDates: ['2026-11-09', '2026-11-09', '2026-11-10', '2026-11-13'] });
    const p = routineProgress(r, '2026-11-13');
    expect(p).toMatchObject({ done: 1, countToday: 1, doneToday: false, streak: 0, missedRecent: '2026-11-12' });
  });

  it('Verlauf: Wochen Mo-So mit erledigt, teilweise, verpasst, offen, Zukunft und außerhalb', () => {
    const r = base({ timesPerDay: 2, days: 0b11111, startDate: '2026-11-09', doneDates: ['2026-11-09', '2026-11-09', '2026-11-10'] });
    const weeks = historyWeeks(r, '2026-11-13', 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].every((c) => c.state === 'outside')).toBe(true);
    expect(weeks[1].map((c) => c.state)).toEqual(['done', 'partial', 'missed', 'missed', 'open', 'off', 'off']);
    expect(weeks[1][1].count).toBe(1);
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
      steps: [{ name: ' Hüftbeuger ', dose: ' 2 x 45 s ' }, { name: '   ', dose: 'x' }], timesPerDay: 9, times: ['20:00', 'bad', '08:00', '08:00'],
    });
    expect(c).toEqual({ title: 'Dehnen', kind: 'mobility', days: 127, startDate: '2026-11-13', endDate: null, reason: null, steps: [{ name: 'Hüftbeuger', dose: '2 x 45 s', exerciseId: null }], timesPerDay: 6, times: ['08:00', '10:30', '13:00', '15:00', '17:30', '20:00'] });
  });

  it('Client-Id passt zum Server-Format', () => {
    const id = newRoutineId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newRoutineId()).not.toBe(id);
  });
});

describe('Routinen: Uhrzeiten je Durchgang', () => {
  it('normalisiert wie der Server und schlägt Zeiten über den Tag verteilt vor', () => {
    expect(normalizeTimes(['20:00', '8:00', '24:00', '13:00', '13:00', '07:30'], 2)).toEqual(['07:30', '13:00']);
    expect(normalizeTimes(undefined, 3)).toEqual([]);
    expect(suggestedTimes(1)).toEqual(['19:00']);
    expect(suggestedTimes(2)).toEqual(['08:00', '20:00']);
    expect(suggestedTimes(3)).toEqual(['08:00', '14:00', '20:00']);
    expect(suggestedTimes(6)).toHaveLength(6);
    expect(slotOf('07:59')).toBe('morning');
    expect(slotOf('11:00')).toBe('midday');
    expect(slotOf('17:00')).toBe('evening');
  });

  it('nächster Durchgang: Zeit des offenen Durchgangs, fällig sobald die Uhrzeit erreicht ist', () => {
    const r = base({ timesPerDay: 3, times: ['08:00', '14:00', '20:00'], doneDates: ['2026-11-12'] });
    expect(nextRound(r, '2026-11-12', '12:00')).toEqual({ k: 2, time: '14:00', due: false });
    expect(nextRound(r, '2026-11-12', '14:00')).toEqual({ k: 2, time: '14:00', due: true });
    expect(nextRound({ ...r, doneDates: Array(3).fill('2026-11-12') }, '2026-11-12', '21:00')).toBeNull();
    // Ohne Zeit: immer fällig
    expect(nextRound(base(), '2026-11-12', '06:00')).toEqual({ k: 1, time: null, due: true });
  });
});

describe('Routinen: Schmerz', () => {
  it('ein Wert je Tag, begrenzt auf 0-10, null entfernt', () => {
    let list = setPainLevel([], '2026-11-10', 4);
    list = setPainLevel(list, '2026-11-09', 12);
    list = setPainLevel(list, '2026-11-10', 3);
    expect(list).toEqual([{ day: '2026-11-09', level: 10 }, { day: '2026-11-10', level: 3 }]);
    expect(setPainLevel(list, '2026-11-09', null)).toEqual([{ day: '2026-11-10', level: 3 }]);
  });

  it('Verlauf und Tendenz: Mittel der letzten 7 Tage gegen die 7 davor', () => {
    const today = '2026-11-20';
    const r = base({ pain: [{ day: '2026-11-08', level: 7 }, { day: '2026-11-10', level: 6 }, { day: '2026-11-12', level: 5 }, { day: '2026-11-17', level: 3 }, { day: '2026-11-19', level: 2 }] });
    const s = painSummary(r, today);
    expect(s.points).toHaveLength(14);
    expect(s.points.slice(0, 2)).toEqual([null, 7]); // 07.11. leer, 08.11. = 7
    expect(s.latest).toEqual({ day: '2026-11-19', level: 2 });
    expect(s.trend).toBe('falling');
    expect(painSummary(base({ pain: [{ day: today, level: 3 }] }), today).trend).toBeNull();
    expect(painSummary(base({ pain: [{ day: '2026-11-10', level: 2 }, { day: '2026-11-18', level: 5 }] }), today).trend).toBe('rising');
    expect([painTone(2), painTone(3), painTone(6)]).toEqual(['ok', 'warn', 'bad']);
  });
});

describe('Routinen: Zeiten auffüllen', () => {
  it('fehlende Durchgänge bekommen eine Zeit mit größtem Abstand, bestehende bleiben', () => {
    expect(fillTimes(['08:00', '20:00'], 3)).toEqual(['08:00', '14:00', '20:00']);
    expect(fillTimes(['07:00', '21:30'], 3)).toEqual(['07:00', '14:00', '21:30']);
    expect(fillTimes(['08:00', '14:00', '20:00'], 2)).toEqual(['08:00', '14:00']);
    expect(fillTimes([], 3)).toEqual([]);
  });
});
