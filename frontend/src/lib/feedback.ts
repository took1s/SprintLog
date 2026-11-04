// Akustisches und haptisches Feedback (Pausentimer).
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

function beep(ctx: AudioContext, frequency: number, start: number, duration: number, volume = 0.12): void {
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
}

export function playRestAlarm({ sound = true, vibration = true } = {}): void {
  if (vibration && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  if (!sound || !audioContext) return;
  try {
    const t = audioContext.currentTime;
    beep(audioContext, 880, t, 0.25);
    beep(audioContext, 880, t + 0.35, 0.25);
    beep(audioContext, 1320, t + 0.7, 0.45);
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
