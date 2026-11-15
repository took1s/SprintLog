import { describe, expect, it } from 'vitest';
import { buildPhases, parseDose, timedSeconds } from '@/lib/routinePlayer';

describe('Dosis lesen', () => {
  it('Halten mit Sätzen und Seiten in allen drei Sprachen', () => {
    expect(parseDose('2 × 30 s per side')).toEqual({ sets: 2, seconds: 30, reps: null, perSide: true });
    expect(parseDose('3 × 30 с на ногу, боль до 3/10')).toEqual({ sets: 3, seconds: 30, reps: null, perSide: true });
    expect(parseDose('2 x 45 s je Seite')).toEqual({ sets: 2, seconds: 45, reps: null, perSide: true });
    expect(parseDose('3 × 20–30 s')).toEqual({ sets: 3, seconds: 20, reps: null, perSide: false });
    expect(parseDose('2 х 40 сек')).toMatchObject({ sets: 2, seconds: 40 });
  });

  it('Wiederholungen, Minuten, ohne Angabe', () => {
    expect(parseDose('3 × 15')).toEqual({ sets: 3, seconds: null, reps: 15, perSide: false });
    expect(parseDose('2 × 10 per leg')).toEqual({ sets: 2, seconds: null, reps: 10, perSide: true });
    expect(parseDose('3–5 reps, lower slowly')).toMatchObject({ sets: 1, reps: 3 });
    expect(parseDose('8 медленных повторов')).toMatchObject({ reps: 8 });
    expect(parseDose('8–10 min: calves, thighs')).toMatchObject({ sets: 1, seconds: 480 });
    expect(parseDose('15–20 Min., sprechen möglich')).toMatchObject({ seconds: 900 });
    expect(parseDose('')).toEqual({ sets: 1, seconds: null, reps: null, perSide: false });
    expect(parseDose('2 × 40 m at 75–80 %')).toMatchObject({ sets: 2, seconds: null });
  });
});

describe('Phasen einer Runde', () => {
  it('Halten je Seite: Arbeit links, Wechsel, rechts, Pause zwischen Sätzen, Vorbereitung vor dem nächsten Schritt', () => {
    const phases = buildPhases([{ name: 'Hüftbeuger', dose: '2 × 30 s je Seite' }, { name: 'Brücke', dose: '2 × 10' }]);
    expect(phases.map((p) => `${p.kind}:${p.step}:${p.set}:${p.side ?? '-'}:${p.seconds ?? p.reps}`)).toEqual([
      'work:0:1:left:30', 'switch:0:1:right:5', 'work:0:1:right:30', 'rest:0:1:-:15',
      'work:0:2:left:30', 'switch:0:2:right:5', 'work:0:2:right:30',
      'next:1:1:-:8', 'work:1:1:-:10', 'rest:1:1:-:30', 'work:1:2:-:10',
    ]);
    expect(timedSeconds(phases)).toBe(30 * 4 + 5 * 2 + 15 + 8 + 30);
  });
});
