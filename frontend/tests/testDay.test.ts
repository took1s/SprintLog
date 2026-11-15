import { describe, expect, it } from 'vitest';
import {
  BLOCKS, YOYO, attemptError, attemptNote, bestOf, blocksFor, cmFromFlightMs, correctHand, equipmentFor, iftAt, iftCompleted, iftCues,
  iftSpeed, iftZoneSeconds, isBest, plannedMinutes, sideFor, warmupFor, yoyoAt, yoyoCompleted, yoyoCues, yoyoDistance, yoyoLabel, type Attempt,
} from '../src/lib/testDay';

const at = (values: Attempt['values'], side?: Attempt['side']): Attempt => ({ values, side, at: Math.random() });

describe('Yo-Yo IR1 Ablauf', () => {
  it('91 Pendel bis 3640 m, Stufen wie die offizielle Tabelle', () => {
    expect(YOYO).toHaveLength(91);
    expect(YOYO[90]!.distance).toBe(3640);
    expect(YOYO.map(yoyoLabel).slice(0, 7)).toEqual(['5.1', '9.1', '11.1', '11.2', '12.1', '12.2', '12.3']);
    expect(yoyoLabel(YOYO[19]!)).toBe('15.1');
    expect(YOYO.find((s) => s.distance === 1400)!.kmh).toBe(15.5);
    expect(YOYO[0]!.legSeconds).toBeCloseTo(7.2, 5);
  });

  it('Phase zu jedem Zeitpunkt: hin, zurück, 10 s Erholung, nächstes Pendel', () => {
    expect(yoyoAt(0)).toMatchObject({ index: 0, phase: 'out' });
    expect(yoyoAt(7300)).toMatchObject({ index: 0, phase: 'back' });
    expect(yoyoAt(14_500)).toMatchObject({ index: 0, phase: 'rest' });
    expect(yoyoAt(24_500)).toMatchObject({ index: 1, phase: 'out' });
    const end = YOYO[90]!.startMs + 2 * YOYO[90]!.legSeconds * 1000 + 1;
    expect(yoyoAt(end).phase).toBe('done');
  });

  it('Stopp-Vorschlag: das laufende bzw. gerade gelaufene Pendel zählt nicht', () => {
    expect(yoyoCompleted(yoyoAt(14_500))).toBe(0); // Fehler am Ziel des 1. Pendels
    expect(yoyoCompleted(yoyoAt(26_000))).toBe(1); // im 2. Pendel
    expect(yoyoDistance(19)).toBe(760);
    expect(yoyoDistance(500)).toBe(3640);
  });

  it('Signale: Start, Wende, Ziel je Pendel, neue Stufe dreifach, 3-2-1 vor jedem Start', () => {
    const cues = yoyoCues();
    expect(cues.filter((c) => c.kind === 'turn')).toHaveLength(91);
    expect(cues.filter((c) => c.kind === 'level')).toHaveLength(15);
    expect(cues.filter((c) => c.kind === 'tick')).toHaveLength(90 * 3);
    expect(cues[0]).toEqual({ at: 0, kind: 'level' });
    expect(cues.find((c) => c.kind === 'turn')!.at).toBeCloseTo(7200, 3);
  });
});

describe('30-15 IFT Ablauf', () => {
  it('Stufen 30 s laufen, 15 s Pause, +0,5 km/h', () => {
    expect(iftSpeed(0)).toBe(8);
    expect(iftSpeed(23)).toBe(19.5);
    expect(iftAt(0)).toMatchObject({ stage: 0, phase: 'run' });
    expect(iftAt(31_000)).toMatchObject({ stage: 0, phase: 'rest' });
    expect(iftAt(45_000)).toMatchObject({ stage: 1, phase: 'run' });
  });

  it('Zonen-Signal alle 20 m: bei 8 km/h alle 9 s', () => {
    expect(iftZoneSeconds(0)).toBeCloseTo(9, 5);
    const first = iftCues().filter((c) => c.at < 30_000 && c.kind === 'turn').map((c) => Math.round(c.at));
    expect(first).toEqual([9000, 18000, 27000]);
  });

  it('Stopp-Vorschlag: beim Laufen zählt die vorige Stufe, in der Pause die gelaufene', () => {
    expect(iftCompleted(iftAt(50_000))).toBe(0);
    expect(iftCompleted(iftAt(80_000))).toBe(1);
    expect(iftCompleted(iftAt(10_000))).toBe(-1);
  });
});

describe('Versuche', () => {
  it('Bestwert je Test unabhängig (Sprint 10 und 30 m), kleiner ist besser', () => {
    const list = [at({ sprint10: 1.82, sprint30: 4.31 }), at({ sprint10: 1.79, sprint30: 4.35 }), at({ sprint10: 1.85, sprint30: 4.28 })];
    expect(bestOf(list, BLOCKS.sprint.tests)).toEqual({ sprint10: 1.79, sprint30: 4.28 });
    expect(isBest(list[0]!, list, BLOCKS.sprint.tests)).toBe(false);
    expect(isBest(list[1]!, list, BLOCKS.sprint.tests)).toBe(true);
    expect(bestOf([at({ cmj: 38 }), at({ cmj: 41.5 })], ['cmj'])).toEqual({ cmj: 41.5 });
  });

  it('Plausibilität: fehlend, außerhalb, 30 m nicht länger als 10 m', () => {
    expect(attemptError('sprint', {})).toBe('missing');
    expect(attemptError('cmj', { cmj: 120 })).toBe('range');
    expect(attemptError('sprint', { sprint10: 3.5, sprint30: 3.4 })).toBe('order');
    expect(attemptError('sprint', { sprint10: 1.9, sprint30: 4.4 })).toBeNull();
  });

  it('Flugzeit -> Höhe (h = g·t²/8) und Handzeit-Korrektur', () => {
    expect(cmFromFlightMs(560)).toBe(38.5);
    expect(cmFromFlightMs(500)).toBe(30.7);
    expect(correctHand(1.8)).toBe(2.04);
  });

  it('5-10-5 abwechselnd links/rechts; Notiz mit allen Versuchen und Messart', () => {
    expect([0, 1, 2, 3].map((i) => sideFor('agility', i))).toEqual(['left', 'right', 'left', 'right']);
    expect(sideFor('sprint', 0)).toBeUndefined();
    const list = [at({ agility: 4.71 }), at({ agility: 4.65 })];
    expect(attemptNote('agility', list, 'stopwatch')).toBe('2x: 4.71 / 4.65 · hand +0.24s');
    expect(attemptNote('agility', list, 'electronic')).toBe('2x: 4.71 / 4.65');
  });
});

describe('Planung', () => {
  it('Reihenfolge immer frisch -> ermüdend, Ausdauer zuletzt', () => {
    expect(blocksFor(['yoyo', 'agility', 'cmj', 'sprint'])).toEqual(['cmj', 'sprint', 'agility', 'yoyo']);
  });

  it('Aufwärmen nur mit passenden Probe-Schritten; Dauer und Material', () => {
    expect(warmupFor(['sprint']).map((w) => w.id)).toEqual(['jog', 'mobility', 'activation', 'drills', 'strides']);
    expect(warmupFor(['cmj', 'agility']).map((w) => w.id)).toContain('jumps');
    expect(plannedMinutes(['cmj', 'sprint', 'agility', 'yoyo'])).toBeGreaterThan(55);
    expect(plannedMinutes(['cmj'], false)).toBe(5);
    expect(equipmentFor(['sprint'], 'electronic')).toEqual({ cones: 4, tape: 31, partner: false });
    expect(equipmentFor(['sprint'], 'stopwatch').partner).toBe(true);
    expect(equipmentFor(['ift'], 'electronic')).toMatchObject({ tape: 40, partner: true });
  });
});
