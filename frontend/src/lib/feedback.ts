// Akustisches und haptisches Feedback (Pausentimer, Zeit-Sätze). Vorlauf und Musik-Ducking: lib/signals.ts.
// iOS/Safari erlauben Audio nur nach einer Nutzerinteraktion -> unlockAudio() beim ersten Klick aufrufen.

let audioContext: AudioContext | null = null;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function unlockAudio(): void {
  try {
    const Ctx = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch { /* Audio nicht verfügbar */ }
}

function beep(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 0.12): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  return osc;
}

/** Laufender Audio-Kontext (oder null) - für genau getaktete Signale (Testtag). */
export async function audioReady(): Promise<AudioContext | null> {
  return ready();
}

/** Ton zu einer Kontext-Zeit planen; der Oszillator kann mit stop() wieder abgesagt werden. */
export function scheduleTone(ctx: AudioContext, frequency: number, at: number, duration: number, volume = 0.3): OscillatorNode | null {
  try { return beep(ctx, frequency, Math.max(ctx.currentTime, at), duration, volume); } catch { return null; }
}

/** Kontext bereit machen (nach suspendAudio() oder iOS-Unterbrechung wieder starten). */
async function ready(): Promise<AudioContext | null> {
  if (!audioContext) return null;
  try {
    if (audioContext.state !== 'running') await audioContext.resume();
  } catch { /* ignore */ }
  return audioContext.state === 'running' ? audioContext : null;
}

export const audioContextRunning = (): boolean => audioContext?.state === 'running';

/** Audio-Ausgabe anhalten (iOS gibt "geduckte" Musik erst frei, wenn unsere Ausgabe ruht). */
export async function suspendAudio(): Promise<void> {
  try {
    if (audioContext?.state === 'running') await audioContext.suspend();
  } catch { /* ignore */ }
}

export function playRestAlarm({ sound = true, vibration = true } = {}): void {
  if (vibration && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  if (!sound || !audioContext) return;
  void ready().then((ctx) => {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + 0.02;
      beep(ctx, 880, t, 0.25);
      beep(ctx, 880, t + 0.35, 0.25);
      beep(ctx, 1320, t + 0.7, 0.45);
    } catch { /* ignore */ }
  });
}

/** Kurzer, leiser Tick für 3-2-1 (letzter etwas höher); silent = nur Audio-Sitzung aktivieren. */
export async function countdownTick(secondsLeft: number, silent = false): Promise<void> {
  const ctx = await ready();
  if (!ctx) return;
  try {
    beep(ctx, secondsLeft === 1 ? 740 : 620, ctx.currentTime + 0.01, 0.09, silent ? 0.0002 : 0.06);
  } catch { /* ignore */ }
}

export interface WakeLockControl { set(enabled: boolean): Promise<void> }

/** Bildschirm während einer aktiven Einheit wach halten (Screen Wake Lock API). */
export function createWakeLock(): WakeLockControl {
  let sentinel: WakeLockSentinel | null = null;
  let pending: Promise<void> | null = null;
  let wanted = false;

  async function release() {
    const s = sentinel;
    sentinel = null;
    if (s) await s.release().catch(() => {});
  }

  function acquire(): Promise<void> {
    if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return Promise.resolve();
    // Nur eine Anfrage gleichzeitig (visibilitychange + set) - sonst entstehen zwei Sperren, freigegeben wird nur eine
    pending ??= (async () => {
      try {
        const s = await navigator.wakeLock.request('screen');
        s.addEventListener('release', () => { if (sentinel === s) sentinel = null; });
        sentinel = s;
        // Während der Anfrage beendet? Dann sofort wieder freigeben (Bildschirm soll nicht wach bleiben)
        if (!wanted) await release();
      } catch { sentinel = null; } finally { pending = null; }
    })();
    return pending;
  }

  document.addEventListener('visibilitychange', () => { void acquire(); });

  return {
    async set(enabled: boolean) {
      wanted = enabled;
      if (enabled) await acquire();
      else { if (pending) await pending; await release(); }
    },
  };
}
