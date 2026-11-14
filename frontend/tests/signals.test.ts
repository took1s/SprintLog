// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Audio und Plattform abschalten: geprüft wird nur der Zeitplan (wann leiser, wann Ticks, wann frei)
const calls: string[] = [];
vi.mock('@/lib/feedback', () => ({
  audioContextRunning: () => true,
  countdownTick: (s: number) => { calls.push(`tick${s}`); return Promise.resolve(); },
  suspendAudio: () => Promise.resolve(),
}));
vi.mock('@/lib/native', () => ({ isNative: () => false }));

describe('Signal-Vorlauf (Musik leiser + 3-2-1)', () => {
  let session: { type: string };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
    calls.length = 0;
    session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
  afterEach(() => vi.useRealTimers());

  it('stellt 3 s vorher leiser, tickt 3-2-1 und gibt nach dem Signal wieder frei', async () => {
    const { createSignalScheduler } = await import('@/lib/signals');
    const s = createSignalScheduler();
    const endAt = Date.now() + 10_000;
    s.plan(endAt, { sound: true, duck: true, countdown: true });
    await vi.advanceTimersByTimeAsync(6_900);
    expect(session.type).toBe('auto');
    await vi.advanceTimersByTimeAsync(200);
    expect(session.type).toBe('transient');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toEqual(['tick3', 'tick2', 'tick1']);
    // Ende: Pausentimer spielt das Signal und meldet es -> kurz danach wieder normal
    await vi.advanceTimersByTimeAsync(1_000);
    s.signalled();
    s.plan(null, { sound: true, duck: true, countdown: true });
    expect(session.type).toBe('transient');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(session.type).toBe('auto');
  });

  it('abgebrochener Timer gibt sofort frei; ohne Ton passiert nichts', async () => {
    const { createSignalScheduler } = await import('@/lib/signals');
    const s = createSignalScheduler();
    s.plan(Date.now() + 2_500, { sound: true, duck: true, countdown: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(session.type).toBe('transient');
    s.plan(null, { sound: true, duck: true, countdown: false });
    await vi.advanceTimersByTimeAsync(10);
    expect(session.type).toBe('auto');
    expect(calls).toEqual([]);

    s.plan(Date.now() + 5_000, { sound: false, duck: true, countdown: true });
    await vi.advanceTimersByTimeAsync(6_000);
    expect(session.type).toBe('auto');
    expect(calls).toEqual([]);
  });
});
