// Genau getaktete Signale für Ausdauertests (Yo-Yo, 30-15): Töne werden über die Web-Audio-Uhr vorausgeplant
// (Lookahead ~1,5 s), nicht per setTimeout - so bleibt der Takt auch bei ruckelnder Oberfläche auf wenige ms genau.
// Stopp sagt alle schon geplanten Töne ab. Optional Sprachansage der Stufe.
import type { Cue } from './testDay';
import { audioReady, scheduleTone, unlockAudio } from './feedback';

const LOOKAHEAD_MS = 1500;
const TONES: Record<Cue['kind'], [number, number, number][]> = {
  // [Frequenz, Versatz s, Dauer s]
  start: [[1046, 0, 0.18]],
  level: [[1318, 0, 0.12], [1318, 0.16, 0.12], [1318, 0.32, 0.2]],
  turn: [[880, 0, 0.16]],
  end: [[880, 0, 0.32]],
  stop: [[587, 0, 0.35], [440, 0.4, 0.55]],
  tick: [[620, 0, 0.08]],
};

export interface CuePlayer {
  /** cues ab t0 (performance.now()-Zeit des Teststarts) abspielen. */
  start(cues: readonly Cue[], t0: number, opts: { sound: boolean; onCue?: (cue: Cue) => void }): void;
  stop(): void;
}

export function createCuePlayer(): CuePlayer {
  let timer = 0;
  let nodes: OscillatorNode[] = [];
  let queue: Cue[] = [];
  let next = 0;
  let fired = 0;
  let base = 0;
  let options: { sound: boolean; onCue?: (cue: Cue) => void } = { sound: true };
  let ctx: AudioContext | null = null;
  /** Abstand Performance-Uhr -> Audio-Uhr (s), einmal beim Start gemessen. */
  let offset = 0;

  function pump() {
    const now = performance.now();
    // Audio-Uhr steht, wenn iOS den Kontext anhält (Hintergrund) -> Abstand neu messen, sobald er spürbar abweicht
    if (ctx) { const est = ctx.currentTime - now / 1000; if (Math.abs(est - offset) > 0.05) offset = est; }
    // Töne vorausplanen
    while (next < queue.length && base + queue[next]!.at <= now + LOOKAHEAD_MS) {
      const cue = queue[next++]!;
      // Verpasste Signale (App war im Hintergrund) nicht nachholen - sonst piept alles auf einmal
      if (base + cue.at < now - 120) continue;
      if (ctx && options.sound) {
        const at = (base + cue.at) / 1000 + offset;
        for (const [f, d, len] of TONES[cue.kind]) {
          const n = scheduleTone(ctx, f, at + d, len, cue.kind === 'tick' ? 0.12 : 0.35);
          if (n) nodes.push(n);
        }
      }
    }
    // Rückmeldung an die Oberfläche (Blitz, Haptik) zum tatsächlichen Zeitpunkt
    while (fired < next && base + queue[fired]!.at <= now) {
      const cue = queue[fired++]!;
      if (base + cue.at >= now - 400) options.onCue?.(cue);
    }
    if (nodes.length > 200) nodes = nodes.slice(-100);
  }

  function stop() {
    window.clearInterval(timer);
    timer = 0;
    for (const n of nodes) { try { n.stop(0); } catch { /* schon beendet */ } }
    nodes = [];
    queue = [];
    next = 0;
    fired = 0;
  }

  return {
    stop,
    start(cues, t0, opts) {
      stop();
      queue = [...cues].sort((a, b) => a.at - b.at);
      base = t0;
      options = opts;
      next = 0;
      fired = 0;
      // Schon vergangene Signale (Fortsetzen) überspringen
      const now = performance.now();
      while (next < queue.length && base + queue[next]!.at < now - 50) next++;
      fired = next;
      unlockAudio();
      void audioReady().then((c) => {
        ctx = c;
        if (c) offset = c.currentTime - performance.now() / 1000;
        pump();
      });
      timer = window.setInterval(pump, 100);
    },
  };
}

/** Kurze Sprachansage (Stufe), wenn das Gerät es kann; stört die Signale nicht (läuft über die System-Sprache). */
export function speak(text: string, lang: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.05;
    synth.speak(u);
  } catch { /* nicht verfügbar */ }
}
