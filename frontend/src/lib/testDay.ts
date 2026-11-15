// Geführter Testtag wie bei Profis: standardisiertes Aufwärmen (RAMP), Reihenfolge von frisch zu ermüdend
// (Sprung -> Sprint -> Richtungswechsel -> Ausdauer), feste Versuche mit Pausen, bester Versuch zählt.
// Ausdauertests mit eigenem Takt: Yo-Yo IR1 (Bangsbo, Tabelle theyoyotest.com) und 30-15 IFT (Buchheit 2008).
// Reine Logik ohne Vue - Komponenten: components/athlete/testday/*.
import { TESTS, type TestId } from './fitnessTests';

export type BlockId = 'cmj' | 'sprint' | 'agility' | 'yoyo' | 'ift';
export type Endurance = 'yoyo' | 'ift';
export type Timing = 'electronic' | 'stopwatch';
export type Side = 'left' | 'right';

/** Reihenfolge eines Testtags: nicht ermüdende Tests zuerst, Ausdauer immer zum Schluss (NSCA-Empfehlung). */
export const BLOCK_ORDER: readonly BlockId[] = ['cmj', 'sprint', 'agility', 'yoyo', 'ift'];

export interface BlockDef {
  id: BlockId;
  tests: TestId[];
  kind: 'attempts' | 'endurance';
  /** Geplante Versuche (bester zählt). */
  attempts: number;
  /** Pause zwischen Versuchen in Sekunden (volle Erholung für maximale Leistung). */
  rest: number;
  /** Ungefähre Dauer inkl. Pausen (Minuten) - für die Planung. */
  minutes: number;
}

export const BLOCKS: Record<BlockId, BlockDef> = {
  cmj: { id: 'cmj', tests: ['cmj'], kind: 'attempts', attempts: 3, rest: 60, minutes: 5 },
  sprint: { id: 'sprint', tests: ['sprint10', 'sprint30'], kind: 'attempts', attempts: 3, rest: 180, minutes: 10 },
  agility: { id: 'agility', tests: ['agility'], kind: 'attempts', attempts: 4, rest: 120, minutes: 9 },
  yoyo: { id: 'yoyo', tests: ['yoyo'], kind: 'endurance', attempts: 1, rest: 0, minutes: 20 },
  ift: { id: 'ift', tests: ['ift'], kind: 'endurance', attempts: 1, rest: 0, minutes: 25 },
};

/** Pause zwischen zwei Tests bzw. vor dem Ausdauertest (Sekunden). */
export const BETWEEN_BLOCKS = 180;
export const BEFORE_ENDURANCE = 300;
/**
 * Handzeit ist schneller als Lichtschranke (Reaktion beim Starten/Stoppen): Mittelwert ~0,24 s (Mayhew et al. 2010,
 * Hand vs. elektronisch). Für den Vergleich mit den Normen wird die Handzeit um diesen Wert korrigiert.
 */
export const HAND_CORRECTION = 0.24;

export const blocksFor = (picked: readonly BlockId[]): BlockId[] => BLOCK_ORDER.filter((b) => picked.includes(b));

export const round = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d;

/** Handzeit -> vergleichbar mit Lichtschranke (nur Zeiten: Sprint, 5-10-5). */
export const correctHand = (value: number): number => round(value + HAND_CORRECTION, 2);

/** Sprunghöhe aus der Flugzeit (h = g·t²/8), Ergebnis in cm - so rechnen Sprungmatten und My Jump. */
export const cmFromFlightMs = (ms: number): number => round((9.81 * (ms / 1000) ** 2) / 8 * 100, 1);

/** 5-10-5 abwechselnd links/rechts starten (2 je Seite). */
export const sideFor = (block: BlockId, attemptIndex: number): Side | undefined =>
  block === 'agility' ? (attemptIndex % 2 === 0 ? 'left' : 'right') : undefined;

export interface Attempt {
  /** Werte dieses Versuchs (schon korrigiert, vergleichbar mit den Normen). */
  values: Partial<Record<TestId, number>>;
  /** Rohwerte der Handzeit (vor Korrektur), nur Anzeige. */
  raw?: Partial<Record<TestId, number>>;
  side?: Side;
  at: number;
}

const better = (test: TestId, a: number, b: number) => (TESTS[test].lowerIsBetter ? a < b : a > b);

/** Bester Wert je Test über alle Versuche (bei Sprint 10 und 30 m unabhängig). */
export function bestOf(attempts: readonly Attempt[], tests: readonly TestId[]): Partial<Record<TestId, number>> {
  const out: Partial<Record<TestId, number>> = {};
  for (const a of attempts) for (const test of tests) {
    const v = a.values[test];
    if (v == null) continue;
    const cur = out[test];
    if (cur == null || better(test, v, cur)) out[test] = v;
  }
  return out;
}

/** Ist dieser Versuch (für mindestens einen Test) der beste? */
export const isBest = (attempt: Attempt, attempts: readonly Attempt[], tests: readonly TestId[]): boolean => {
  const best = bestOf(attempts, tests);
  return tests.some((t) => attempt.values[t] != null && attempt.values[t] === best[t]);
};

/** Plausibel? Grenzen wie der Server; 30 m muss länger dauern als 10 m. */
export function attemptError(block: BlockId, values: Partial<Record<TestId, number | null>>): 'missing' | 'range' | 'order' | null {
  const tests = BLOCKS[block].tests;
  if (tests.every((t) => values[t] == null)) return 'missing';
  for (const t of tests) {
    const v = values[t];
    if (v != null && (v < TESTS[t].min || v > TESTS[t].max)) return 'range';
  }
  if (block === 'sprint' && values.sprint10 != null && values.sprint30 != null && values.sprint30 <= values.sprint10) return 'order';
  return null;
}

/** Kurze Notiz zum gespeicherten Ergebnis (max. 200 Zeichen wie der Server): alle Versuche und Messart. */
export function attemptNote(test: TestId, attempts: readonly Attempt[], timing: Timing): string {
  const vals = attempts.map((a) => a.values[test]).filter((v): v is number => v != null);
  const hand = timing === 'stopwatch' && TESTS[test].unit === 's';
  const text = `${vals.length}x: ${vals.map((v) => v.toFixed(TESTS[test].decimals)).join(' / ')}${hand ? ` · hand +${HAND_CORRECTION}s` : ''}`;
  return text.slice(0, 200);
}

// ---------- Aufwärmen (RAMP: Raise, Activate/Mobilise, Potentiate) ----------

export interface WarmupStep { id: 'jog' | 'mobility' | 'activation' | 'drills' | 'strides' | 'jumps' | 'cod'; seconds?: number; only?: BlockId }
export const WARMUP: readonly WarmupStep[] = [
  { id: 'jog', seconds: 180 },
  { id: 'mobility', seconds: 180 },
  { id: 'activation', seconds: 120 },
  { id: 'drills', seconds: 120 },
  { id: 'strides' },
  { id: 'jumps', only: 'cmj' },
  { id: 'cod', only: 'agility' },
];
export const warmupFor = (blocks: readonly BlockId[]): WarmupStep[] => WARMUP.filter((s) => !s.only || blocks.includes(s.only));

/** Geschätzte Gesamtdauer in Minuten (Aufwärmen + Tests + Pausen). */
export function plannedMinutes(blocks: readonly BlockId[], withWarmup = true): number {
  const warm = withWarmup ? warmupFor(blocks).reduce((s, w) => s + (w.seconds ?? 90), 0) / 60 : 0;
  const tests = blocks.reduce((s, b) => s + BLOCKS[b].minutes, 0);
  const between = blocks.slice(1).reduce((s, b) => s + (BLOCKS[b].kind === 'endurance' ? BEFORE_ENDURANCE : BETWEEN_BLOCKS), 0) / 60;
  return Math.round(warm + tests + between);
}

/** Material je nach Tests: Hütchen, Maßband, Partner. */
export function equipmentFor(blocks: readonly BlockId[], timing: Timing): { cones: number; tape: number; partner: boolean } {
  let cones = 0, tape = 0;
  if (blocks.includes('sprint')) { cones = Math.max(cones, 4); tape = Math.max(tape, 31); }
  if (blocks.includes('agility')) { cones += 3; tape = Math.max(tape, 10); }
  if (blocks.includes('yoyo')) { cones += 3; tape = Math.max(tape, 25); }
  if (blocks.includes('ift')) { cones += 5; tape = Math.max(tape, 40); }
  const partner = blocks.some((b) => BLOCKS[b].kind === 'endurance') || (timing === 'stopwatch' && blocks.some((b) => b === 'sprint' || b === 'agility'));
  return { cones, tape, partner };
}

// ---------- Yo-Yo Intermittent Recovery Test Level 1 ----------

/** [Geschwindigkeitsstufe, km/h, Pendel (2 × 20 m)] - offizielle Tabelle; Summe 91 Pendel = 3640 m. */
const YOYO_LEVELS: readonly [number, number, number][] = [
  [5, 10, 1], [9, 12, 1], [11, 13, 2], [12, 13.5, 3], [13, 14, 4], [14, 14.5, 8], [15, 15, 8], [16, 15.5, 8], [17, 16, 8],
  [18, 16.5, 8], [19, 17, 8], [20, 17.5, 8], [21, 18, 8], [22, 18.5, 8], [23, 19, 8],
];
export const YOYO_RECOVERY = 10;

export interface Shuttle { n: number; level: number; shuttle: number; kmh: number; distance: number; legSeconds: number; startMs: number }

/** Alle Pendel mit Startzeit ab Teststart (ms). Ein Pendel: 20 m hin, 20 m zurück, dann 10 s aktive Erholung. */
export const YOYO: readonly Shuttle[] = (() => {
  const out: Shuttle[] = [];
  let at = 0, distance = 0;
  for (const [level, kmh, count] of YOYO_LEVELS) for (let s = 1; s <= count; s++) {
    const legSeconds = 72 / kmh; // 20 m bei kmh
    distance += 40;
    out.push({ n: out.length, level, shuttle: s, kmh, distance, legSeconds, startMs: at });
    at += (2 * legSeconds + YOYO_RECOVERY) * 1000;
  }
  return out;
})();

export const yoyoLabel = (s: Shuttle): string => `${s.level}.${s.shuttle}`;

export interface YoyoState { index: number; phase: 'out' | 'back' | 'rest' | 'done'; phaseMs: number; leftMs: number }

/** Zustand zum Zeitpunkt ms nach dem Start. */
export function yoyoAt(ms: number): YoyoState {
  if (ms < 0) return { index: 0, phase: 'out', phaseMs: 0, leftMs: YOYO[0]!.legSeconds * 1000 };
  let i = YOYO.length - 1;
  while (i > 0 && YOYO[i]!.startMs > ms) i--;
  const s = YOYO[i]!;
  const leg = s.legSeconds * 1000;
  const t = ms - s.startMs;
  if (t < leg) return { index: i, phase: 'out', phaseMs: leg, leftMs: leg - t };
  if (t < 2 * leg) return { index: i, phase: 'back', phaseMs: leg, leftMs: 2 * leg - t };
  if (t < 2 * leg + YOYO_RECOVERY * 1000 && i < YOYO.length - 1) return { index: i, phase: 'rest', phaseMs: YOYO_RECOVERY * 1000, leftMs: 2 * leg + YOYO_RECOVERY * 1000 - t };
  return { index: i, phase: i === YOYO.length - 1 && t >= 2 * leg ? 'done' : 'rest', phaseMs: YOYO_RECOVERY * 1000, leftMs: 0 };
}

/**
 * Vorschlag beim Stopp: Ein Fehlversuch wird am Signal erkannt -> das gerade gelaufene bzw. laufende Pendel zählt nicht.
 * Ergebnis = Anzahl voll geschaffter Pendel (Trainer kann ±1 korrigieren).
 */
export const yoyoCompleted = (state: YoyoState): number => (state.phase === 'done' ? YOYO.length : state.index);
export const yoyoDistance = (completed: number): number => Math.max(0, Math.min(YOYO.length, completed)) * 40;

export interface Cue { at: number; kind: 'start' | 'level' | 'turn' | 'end' | 'stop' | 'tick' }

/** Signale ab Teststart (ms): Start (neue Stufe dreifach), Wende bei 20 m, Ziel bei 40 m, 3-2-1 vor dem nächsten Start. */
export function yoyoCues(): Cue[] {
  const cues: Cue[] = [];
  YOYO.forEach((s, i) => {
    const leg = s.legSeconds * 1000;
    const newLevel = i === 0 || YOYO[i - 1]!.level !== s.level;
    cues.push({ at: s.startMs, kind: newLevel ? 'level' : 'start' }, { at: s.startMs + leg, kind: 'turn' }, { at: s.startMs + 2 * leg, kind: 'end' });
    const next = YOYO[i + 1];
    if (next) for (let k = 3; k >= 1; k--) cues.push({ at: next.startMs - k * 1000, kind: 'tick' });
  });
  return cues;
}

// ---------- 30-15 Intermittent Fitness Test ----------

export const IFT_START = 8;
export const IFT_STEP = 0.5;
export const IFT_RUN = 30;
export const IFT_REST = 15;
/** Bis 26 km/h (37 Stufen) - mehr schafft niemand. */
export const IFT_STAGES = 37;
export const iftSpeed = (stage: number): number => IFT_START + stage * IFT_STEP;
/** Sekunden für 20 m (eine Zone zur nächsten: Ende -> Mitte -> Ende). */
export const iftZoneSeconds = (stage: number): number => 20 / (iftSpeed(stage) / 3.6);

export interface IftState { stage: number; phase: 'run' | 'rest' | 'done'; phaseMs: number; leftMs: number }

export function iftAt(ms: number): IftState {
  const period = (IFT_RUN + IFT_REST) * 1000;
  if (ms < 0) return { stage: 0, phase: 'run', phaseMs: IFT_RUN * 1000, leftMs: IFT_RUN * 1000 };
  const stage = Math.floor(ms / period);
  if (stage >= IFT_STAGES) return { stage: IFT_STAGES - 1, phase: 'done', phaseMs: IFT_REST * 1000, leftMs: 0 };
  const t = ms - stage * period;
  return t < IFT_RUN * 1000
    ? { stage, phase: 'run', phaseMs: IFT_RUN * 1000, leftMs: IFT_RUN * 1000 - t }
    : { stage, phase: 'rest', phaseMs: IFT_REST * 1000, leftMs: period - t };
}

/**
 * Vorschlag beim Stopp: während des Laufens zählt die laufende Stufe nicht (3. Fehlversuch), in der Pause ist die
 * gerade gelaufene Stufe geschafft. Ergebnis = Geschwindigkeit der letzten geschafften Stufe; -1 = keine.
 */
export const iftCompleted = (state: IftState): number => (state.phase === 'run' ? state.stage - 1 : state.stage);

/** Signale: Start jeder Stufe, Zonen-Signal alle 20 m, langes Signal am Ende der 30 s, 3-2-1 vor dem nächsten Start. */
export function iftCues(): Cue[] {
  const cues: Cue[] = [];
  const period = (IFT_RUN + IFT_REST) * 1000;
  for (let s = 0; s < IFT_STAGES; s++) {
    const start = s * period;
    cues.push({ at: start, kind: s === 0 ? 'level' : 'start' });
    const zone = iftZoneSeconds(s) * 1000;
    for (let t = zone; t < IFT_RUN * 1000 - 250; t += zone) cues.push({ at: start + t, kind: 'turn' });
    cues.push({ at: start + IFT_RUN * 1000, kind: 'stop' });
    if (s < IFT_STAGES - 1) for (let k = 3; k >= 1; k--) cues.push({ at: start + period - k * 1000, kind: 'tick' });
  }
  return cues;
}
