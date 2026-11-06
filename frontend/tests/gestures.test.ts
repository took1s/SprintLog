import { describe, expect, it } from 'vitest';
import { dismissDistance, rubberBand, shouldDismiss, velocityOf } from '@/lib/gestures';
import { easeOutCubic } from '@/lib/tween';

describe('Sheet nach unten ziehen', () => {
  it('schließt ab ~30 % der Höhe (80-160 px) oder bei kräftigem Schnippen', () => {
    expect(dismissDistance(100)).toBe(80);
    expect(dismissDistance(400)).toBe(120);
    expect(dismissDistance(1000)).toBe(160);
    expect(shouldDismiss(170, 0, 800)).toBe(true);
    expect(shouldDismiss(60, 0.1, 800)).toBe(false);
    expect(shouldDismiss(30, 0.9, 800)).toBe(true);
    expect(shouldDismiss(10, 2, 800)).toBe(false); // kurzes Zucken
    expect(shouldDismiss(-40, 2, 800)).toBe(false);
  });

  it('gibt nach oben nur gedämpft nach', () => {
    expect(rubberBand(50)).toBe(50);
    expect(rubberBand(-4)).toBeLessThan(0);
    expect(rubberBand(-10_000)).toBe(-24);
  });

  it('misst die Geschwindigkeit der letzten 100 ms', () => {
    expect(velocityOf([])).toBe(0);
    expect(velocityOf([{ t: 0, y: 0 }, { t: 500, y: 10 }, { t: 550, y: 60 }, { t: 600, y: 110 }])).toBeCloseTo(1, 5);
  });
});

describe('easeOutCubic', () => {
  it('läuft von 0 bis 1 und bremst am Ende', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
