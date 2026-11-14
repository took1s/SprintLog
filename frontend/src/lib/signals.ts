// Signale am Ende einer Pause oder eines Zeit-Satzes: Musik anderer Apps vorher leiser stellen ("Ducking"),
// 3-2-1 leise mitzählen, nach dem Signal die Lautstärke wieder freigeben.
//
// Wie leiser gestellt wird:
// - iOS-App: eigenes Plugin "AudioDuck" (AVAudioSession .duckOthers) - zuverlässig, auch Spotify/Apple Music
// - Safari/PWA: Audio Session API (navigator.audioSession.type = 'transient'), sonst ohne Ducking
// Ohne Unterstützung bleibt alles wie bisher: Signal einfach über die Musik.
import { isNative } from './native';
import { audioContextRunning, countdownTick, suspendAudio } from './feedback';

/** Vorlauf: so viele Sekunden vor dem Ende wird leiser gestellt bzw. gezählt. */
export const COUNTDOWN_SECONDS = 3;
/** Nach dem Signal so lange warten, bevor die Musik wieder laut wird. */
const RELEASE_AFTER_MS = 1800;

interface AudioDuckPlugin { duck(): Promise<void>; release(): Promise<void> }
let plugin: Promise<AudioDuckPlugin> | null = null;
const nativePlugin = () => (plugin ??= import('@capacitor/core').then((m) => m.registerPlugin<AudioDuckPlugin>('AudioDuck')));

type SessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record';
type AudioSessionNavigator = Navigator & { audioSession?: { type: SessionType } };
const webSession = () => (navigator as AudioSessionNavigator).audioSession ?? null;

/** Kann das Gerät andere Audio-Quellen leiser stellen? (Einstellungen zeigen sonst einen Hinweis.) */
export function duckingSupported(): boolean {
  return isNative() || !!webSession();
}

let ducked = false;
let webBefore: SessionType | null = null;

/** Andere Audio-Quellen leiser stellen (idempotent). */
export async function duck(): Promise<void> {
  if (ducked) return;
  ducked = true;
  try {
    if (isNative()) {
      await (await nativePlugin()).duck();
      return;
    }
    const s = webSession();
    if (s) {
      webBefore = s.type;
      s.type = 'transient';
    }
  } catch (e) {
    // Ältere App-Version ohne Plugin: kein Fehler für den Nutzer
    console.warn('[signals] duck', e);
  }
}

/** Musik wieder auf normale Lautstärke (idempotent). */
export async function release(): Promise<void> {
  if (!ducked) return;
  ducked = false;
  try {
    if (isNative()) {
      // iOS gibt die Lautstärke erst frei, wenn unsere Audio-Ausgabe ruht -> Kontext anhalten (startet beim nächsten Ton neu)
      await suspendAudio();
      await (await nativePlugin()).release();
      return;
    }
    const s = webSession();
    if (s) s.type = webBefore ?? 'auto';
    webBefore = null;
  } catch (e) {
    console.warn('[signals] release', e);
  }
}

export interface SignalOptions {
  /** Musik vorher leiser stellen. */
  duck: boolean;
  /** Leise Ticks bei 3-2-1. */
  countdown: boolean;
  /** Ton überhaupt erlaubt (Einstellung "Signalton"). */
  sound: boolean;
}

export interface SignalScheduler {
  /** Ende (ms seit Epoch) einplanen; null = abbrechen. Mehrfach aufrufbar (Timer verlängert/pausiert). */
  plan(endAt: number | null, options: SignalOptions): void;
  /** Nach dem eigentlichen Signal: Lautstärke etwas später freigeben. */
  signalled(): void;
  dispose(): void;
}

/**
 * Plant Vorlauf (Ducking + Ticks) vor einem bekannten Ende. Das eigentliche Signal spielt weiterhin der Aufrufer
 * (Pausentimer bzw. Zeit-Satz), damit es auch ohne Vorlauf kommt; danach signalled() aufrufen.
 */
export function createSignalScheduler(): SignalScheduler {
  let timers: number[] = [];
  let releaseTimer = 0;
  let plannedFor: number | null = null;

  const clear = () => { timers.forEach((id) => window.clearTimeout(id)); timers = []; };

  return {
    plan(endAt, options) {
      if (endAt === plannedFor) return;
      clear();
      plannedFor = endAt;
      // Abgebrochen/zu Ende: sofort freigeben - außer das Signal läuft gerade (dann gibt signalled() frei)
      if (endAt == null || !options.sound) { if (!releaseTimer) void release(); return; }
      const now = Date.now();
      let first = true;
      for (let s = COUNTDOWN_SECONDS; s >= 1; s--) {
        const at = endAt - s * 1000;
        if (at < now - 150) {
          // Tick schon vorbei (Timer kurz vor Ende gestartet/verlängert): sofort leiser stellen, nur ohne Tick
          if (first && options.duck && endAt - now > 300) timers.push(window.setTimeout(() => { if (document.visibilityState === 'visible') void duck(); }, 0));
          first = false;
          continue;
        }
        const lead = first; // der erste noch kommende Tick stellt leiser (auch bei nur 2 s Restzeit)
        first = false;
        timers.push(window.setTimeout(() => {
          if (document.visibilityState !== 'visible') return;
          // Erst leiser stellen, dann ticken - iOS blendet in ~0,3 s ab
          if (options.duck && lead) void duck();
          if (options.countdown) void countdownTick(s);
          else if (options.duck && lead && !audioContextRunning()) void countdownTick(s, true); // stumm: Sitzung aktivieren
        }, Math.max(0, at - now)));
      }
      // Sicherheitsnetz: nie dauerhaft leise lassen (z. B. Timer im Hintergrund abgelaufen)
      timers.push(window.setTimeout(() => void release(), Math.max(0, endAt - now) + RELEASE_AFTER_MS + 4000));
    },
    signalled() {
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => { releaseTimer = 0; void release(); }, RELEASE_AFTER_MS);
    },
    dispose() {
      clear();
      window.clearTimeout(releaseTimer);
      releaseTimer = 0;
      plannedFor = null;
      void release();
    },
  };
}
