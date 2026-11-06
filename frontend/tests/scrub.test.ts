import { describe, expect, it } from 'vitest';
import { markerOffset, segmentAt, swipeDirection } from '@/lib/scrub';

describe('Segmentleiste durchziehen', () => {
  // Leiste von x=10 bis x=410, vier Segmente à 100 px
  it('findet das Segment unter dem Finger und bleibt am Rand im Bereich', () => {
    expect(segmentAt(10, 10, 400, 4)).toBe(0);
    expect(segmentAt(109, 10, 400, 4)).toBe(0);
    expect(segmentAt(110, 10, 400, 4)).toBe(1);
    expect(segmentAt(409, 10, 400, 4)).toBe(3);
    expect(segmentAt(-50, 10, 400, 4)).toBe(0); // links daneben
    expect(segmentAt(900, 10, 400, 4)).toBe(3); // rechts daneben
    expect(segmentAt(200, 10, 400, 1)).toBe(0);
    expect(segmentAt(200, 10, 0, 4)).toBe(0); // noch nicht gemessen
  });

  it('Marker mittig unter dem Finger, nie über den Rand hinaus', () => {
    expect(markerOffset(160, 10, 400, 4)).toBe(100); // Finger in der Mitte von Segment 2
    expect(markerOffset(15, 10, 400, 4)).toBe(0);
    expect(markerOffset(405, 10, 400, 4)).toBe(300);
    expect(markerOffset(1000, 10, 400, 6)).toBeCloseTo(400 - 400 / 6);
  });
});

describe('Wischen im Inhalt', () => {
  it('weit genug seitlich = Abschnitt wechseln (links = weiter)', () => {
    expect(swipeDirection(-90, 10, 300)).toBe(1);
    expect(swipeDirection(90, -12, 300)).toBe(-1);
  });

  it('kurz, aber schnell zählt auch', () => {
    expect(swipeDirection(-50, 4, 80)).toBe(1);
    expect(swipeDirection(-50, 4, 400)).toBe(0); // langsam und kurz: eher Zittern
  });

  it('Scrollen (eher senkrecht) oder winzige Bewegung wechselt nichts', () => {
    expect(swipeDirection(-80, 60, 200)).toBe(0);
    expect(swipeDirection(-30, 0, 50)).toBe(0);
    expect(swipeDirection(0, 300, 200)).toBe(0);
  });
});
