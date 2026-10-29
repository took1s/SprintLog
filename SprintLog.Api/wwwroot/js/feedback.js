// Akustisches und haptisches Feedback (Pausentimer).
// iOS/Safari erlauben Audio nur nach einer Nutzerinteraktion -> unlockAudio() beim ersten Klick aufrufen.

let audioContext = null;

export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch { /* Audio nicht verfügbar */ }
}

function beep(frequency, start, duration, volume = 0.12) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function playRestAlarm({ sound = true, vibration = true } = {}) {
  if (vibration && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  if (!sound || !audioContext) return;
  try {
    const t = audioContext.currentTime;
    beep(880, t, 0.25);
    beep(880, t + 0.35, 0.25);
    beep(1320, t + 0.7, 0.45);
  } catch { /* ignore */ }
}

/** Bildschirm während einer aktiven Einheit wach halten (Screen Wake Lock API). */
export function createWakeLock() {
  let sentinel = null;
  let wanted = false;

  async function acquire() {
    if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => { sentinel = null; });
    } catch { sentinel = null; }
  }

  document.addEventListener('visibilitychange', acquire);

  return {
    async set(enabled) {
      wanted = enabled;
      if (enabled) await acquire();
      else if (sentinel) { await sentinel.release().catch(() => {}); sentinel = null; }
    },
  };
}
