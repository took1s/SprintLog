// Animierte Übungsfigur (SVG) - eigene Skelett-Animation, keine fremden Bilder/Lizenzen, offline.
//
// Modell: Gelenke mit absoluten Winkeln in Grad.  0 = zeigt nach unten, 90 = nach vorne (rechts),
// 180 = nach oben, -90 = nach hinten. Seitenansicht ("side") oder Frontansicht ("front").
// Eine Bewegung besteht aus Keyframes; dazwischen wird weich interpoliert (Sinus-Easing) und geloopt.
// Ein "Anker" hält einen Körperpunkt fest (z. B. Füße am Boden, Hände an der Stange).

import type { Exercise, TrackingType } from '../types';

/** Punkt [x, y] im SVG-Koordinatensystem. */
export type Pt = [number, number];
/** Felder einer Pose: Gelenkwinkel (N = nah, F = fern, R/L = rechts/links in der Frontansicht) und Skalierungen. */
export const POSE_FIELDS = ['torso', 'head', 'aN', 'fN', 'aF', 'fF', 'tN', 'sN', 'tF', 'sF', 'ftN', 'ftF', 'shrug',
  'lean', 'aR', 'fR', 'aL', 'fL', 'tR', 'sR', 'tL', 'sL', 'thighScale'] as const;
export type PoseField = (typeof POSE_FIELDS)[number];
/** Gelenkwinkel einer Pose (siehe Kopfkommentar) + optional Zielposition des Ankers. Fehlende Winkel = NaN wie in JS. */
export type Pose = Partial<Record<PoseField, number>> & { at?: Pt };
/** Benannte Punkte des Skeletts (hip, shoulder, handN, ...). */
export type Skeleton = Record<string, Pt>;
export type Anchor = 'ground' | 'lowest' | string;

export interface Motion {
  label: string;
  view?: 'side' | 'front';
  duration: number;
  anchor?: Anchor;
  at: Pt;
  props?: string[];
  frames: Pose[];
  snap?: boolean;
}

export interface Technique { muscles: string[]; cues: string[] }

export const VIEW = Object.freeze({ W: 220, H: 200, GROUND: 188 });
const { W, GROUND } = VIEW;
const CX = W / 2;
const G = GROUND;

const L = { torso: 46, neck: 6, head: 8, ua: 26, fa: 23, th: 34, sh: 32, ft: 10 };

const rad = (d: number) => (d * Math.PI) / 180;
const vec = (deg: number | undefined, len: number): Pt => [Math.sin(rad(deg ?? NaN)) * len, Math.cos(rad(deg ?? NaN)) * len];
const add = (p: Pt, v: Pt): Pt => [p[0] + v[0], p[1] + v[1]];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: number | undefined, b: number | undefined, t: number) => (a ?? NaN) + ((b ?? NaN) - (a ?? NaN)) * t;
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// ---------------------------------------------------------------------------
// Skelett
// ---------------------------------------------------------------------------

/** Seitenansicht. Fehlende Werte der "fernen" Seite (F) übernehmen die nahe Seite (N). */
function sideSkeleton(p: Pose): Skeleton {
  const hip: Pt = [0, 0];
  const shoulder = add(hip, vec(p.torso, L.torso + (p.shrug ?? 0)));
  const headDir = p.head ?? p.torso;
  const neck = add(shoulder, vec(headDir, L.neck));
  const head = add(neck, vec(headDir, L.head));
  const limb = (a: number | undefined, f: number | undefined) => {
    const elbow = add(shoulder, vec(a, L.ua));
    return { elbow, hand: add(elbow, vec(f, L.fa)) };
  };
  const leg = (t: number | undefined, s: number | undefined, ft: number | undefined) => {
    const knee = add(hip, vec(t, L.th));
    const ankle = add(knee, vec(s, L.sh));
    return { knee, ankle, toe: add(ankle, vec(ft, L.ft)) };
  };
  const armN = limb(p.aN, p.fN);
  const armF = limb(p.aF ?? p.aN, p.fF ?? p.fN);
  const legN = leg(p.tN, p.sN, p.ftN ?? 90);
  const legF = leg(p.tF ?? p.tN, p.sF ?? p.sN, p.ftF ?? p.ftN ?? 90);
  return {
    hip, shoulder, neck, head,
    elbowN: armN.elbow, handN: armN.hand, elbowF: armF.elbow, handF: armF.hand,
    kneeN: legN.knee, ankleN: legN.ankle, toeN: legN.toe,
    kneeF: legF.knee, ankleF: legF.ankle, toeF: legF.toe,
  };
}

/** Frontansicht: rechte Seite (R) = Bildschirm rechts, linke Seite (L) gespiegelt. Winkel = "nach außen". */
function frontSkeleton(p: Pose): Skeleton {
  const hip: Pt = [0, 0];
  const shoulder = add(hip, vec(180 + (p.lean ?? 0), L.torso + (p.shrug ?? 0)));
  const neck = add(shoulder, vec(180 + (p.lean ?? 0), L.neck));
  const head = add(neck, vec(180 + (p.lean ?? 0), L.head));
  const mirror = (deg: number | undefined, len: number, side: number): Pt => {
    const [x, y] = vec(deg, len);
    return [side * x, y];
  };
  const sw = 13; // halbe Schulterbreite
  const hw = 8;  // halbe Hüftbreite
  const shR = add(shoulder, [sw, 2]);
  const shL = add(shoulder, [-sw, 2]);
  const hipR = add(hip, [hw, 0]);
  const hipL = add(hip, [-hw, 0]);
  const thigh = L.th * (p.thighScale ?? 1);
  const arm = (s: Pt, a: number | undefined, f: number | undefined, side: number) => {
    const elbow = add(s, mirror(a, L.ua, side));
    return { elbow, hand: add(elbow, mirror(f, L.fa, side)) };
  };
  const leg = (h: Pt, t: number | undefined, sh: number | undefined, side: number) => {
    const knee = add(h, mirror(t, thigh, side));
    const ankle = add(knee, mirror(sh, L.sh, side));
    return { knee, ankle, toe: add(ankle, [side * 4, 0]) };
  };
  const aR = arm(shR, p.aR, p.fR ?? p.aR, 1);
  const aL = arm(shL, p.aL ?? p.aR, p.fL ?? p.fR ?? p.aL ?? p.aR, -1);
  const lR = leg(hipR, p.tR ?? 4, p.sR ?? 0, 1);
  const lL = leg(hipL, p.tL ?? p.tR ?? 4, p.sL ?? p.sR ?? 0, -1);
  return {
    hip, shoulder, neck, head, shR, shL, hipR, hipL,
    elbowN: aR.elbow, handN: aR.hand, elbowF: aL.elbow, handF: aL.hand,
    kneeN: lR.knee, ankleN: lR.ankle, toeN: lR.toe,
    kneeF: lL.knee, ankleF: lL.ankle, toeF: lL.toe,
  };
}

/** Punkt eines Skeletts nach Name (inkl. abgeleiteter Punkte). */
function point(s: Skeleton, name: string): Pt {
  switch (name) {
    case 'ankleMid': return mid(s.ankleN, s.ankleF);
    case 'handMid': return mid(s.handN, s.handF);
    case 'kneeMid': return mid(s.kneeN, s.kneeF);
    default: return s[name];
  }
}

function translate(s: Skeleton, dx: number, dy: number): Skeleton {
  const out: Skeleton = {};
  for (const [k, v] of Object.entries(s)) out[k] = [v[0] + dx, v[1] + dy];
  return out;
}

/** Verschiebt das Skelett so, dass der Ankerpunkt auf `at` liegt. "lowest" = tiefster Punkt auf Bodenhöhe. */
function anchorSkeleton(s: Skeleton, anchor: Anchor, at: Pt): Skeleton {
  if (anchor === 'lowest') {
    const maxY = Math.max(...Object.values(s).map((p) => p[1])) + 4;
    return translate(s, at[0] - s.hip[0], at[1] - maxY);
  }
  if (anchor === 'ground') {
    // Füße/Zehen auf den Boden, horizontal an der Fußmitte ausrichten
    const feet = [s.ankleN, s.ankleF, s.toeN, s.toeF];
    const maxY = Math.max(...feet.map((p) => p[1])) + 3;
    const fx = mid(s.ankleN, s.ankleF)[0];
    return translate(s, at[0] - fx, at[1] - maxY);
  }
  const p = point(s, anchor);
  return translate(s, at[0] - p[0], at[1] - p[1]);
}

// ---------------------------------------------------------------------------
// Bewegungen
// ---------------------------------------------------------------------------

const STAND: Pose = { torso: 180, aN: 4, fN: 4, aF: -4, fF: -4, tN: 3, sN: 0, tF: -3, sF: 0 };
const pose = (overrides: Partial<Pose>): Pose => ({ ...STAND, ...overrides } as Pose);

/** Tauscht nahe/ferne Gliedmaßen (für Lauf-Zyklen). */
function swapSides(p: Pose): Pose {
  return {
    ...p,
    aN: p.aF ?? p.aN, fN: p.fF ?? p.fN, aF: p.aN, fF: p.fN,
    tN: p.tF ?? p.tN, sN: p.sF ?? p.sN, tF: p.tN, sF: p.sN,
    ftN: p.ftF ?? p.ftN, ftF: p.ftN,
  };
}

const GROUND_AT: Pt = [CX, GROUND];

/**
 * Bewegungsmuster. Felder:
 *   view: 'side' | 'front'      anchor: Ankerpunkt (siehe anchorSkeleton)      at: Zielposition des Ankers
 *   duration: ms für einen Zyklus      frames: Posen (Frame-Feld `at` überschreibt die Ankerposition)
 *   props: Geräte (barbell, dumbbell, bench, bar, cable, box, ...)      snap: letzter -> erster Frame ohne Übergang
 */
export const MOTIONS: Record<string, Motion> = {
  squat: {
    label: 'Squat', duration: 2600, anchor: 'ground', at: GROUND_AT, props: ['barbellBack'],
    frames: [
      pose({ torso: 176, aN: -60, fN: 165, aF: -55, fF: 160 }),
      pose({ torso: 138, aN: -95, fN: 130, aF: -90, fF: 125, tN: 88, sN: -28, tF: 84, sF: -26 }),
    ],
  },
  gobletSquat: {
    label: 'Goblet squat', duration: 2600, anchor: 'ground', at: GROUND_AT, props: ['dumbbellChest'],
    frames: [
      pose({ torso: 178, aN: 20, fN: 160, aF: 15, fF: 155 }),
      pose({ torso: 145, aN: 60, fN: 175, aF: 55, fF: 170, tN: 90, sN: -25, tF: 86, sF: -24 }),
    ],
  },
  deadlift: {
    label: 'Deadlift', duration: 2800, anchor: 'ground', at: GROUND_AT, props: ['barbell'],
    frames: [
      pose({ torso: 118, aN: 2, fN: 2, aF: -2, fF: -2, tN: 62, sN: -18, tF: 58, sF: -16 }),
      pose({ torso: 180, aN: 2, fN: 2, aF: -2, fF: -2 }),
    ],
  },
  rdl: {
    label: 'Hip hinge', duration: 2800, anchor: 'ground', at: GROUND_AT, props: ['barbell'],
    frames: [
      pose({ torso: 180, aN: 2, fN: 2, aF: -2, fF: -2 }),
      pose({ torso: 100, aN: 2, fN: 2, aF: -2, fF: -2, tN: 22, sN: -8, tF: 18, sF: -8 }),
    ],
  },
  bench: {
    label: 'Bench press', duration: 2400, anchor: 'hip', at: [132, G - 40], props: ['bench', 'barbell'],
    frames: [
      { torso: -90, head: -95, aN: 180, fN: 180, aF: 176, fF: 176, tN: 72, sN: 2, tF: 68, sF: 2 },
      { torso: -90, head: -95, aN: 68, fN: 180, aF: 64, fF: 178, tN: 72, sN: 2, tF: 68, sF: 2 },
    ],
  },
  inclineBench: {
    label: 'Incline press', duration: 2400, anchor: 'hip', at: [128, G - 42], props: ['benchIncline', 'barbell'],
    frames: [
      { torso: -125, head: -130, aN: 168, fN: 168, aF: 164, fF: 164, tN: 72, sN: 2, tF: 68, sF: 2 },
      { torso: -125, head: -130, aN: 75, fN: 172, aF: 71, fF: 170, tN: 72, sN: 2, tF: 68, sF: 2 },
    ],
  },
  dbBench: {
    label: 'Dumbbell press', duration: 2400, anchor: 'hip', at: [132, G - 40], props: ['bench', 'dumbbells'],
    frames: [
      { torso: -90, head: -95, aN: 180, fN: 180, aF: 176, fF: 176, tN: 72, sN: 2, tF: 68, sF: 2 },
      { torso: -90, head: -95, aN: 72, fN: 178, aF: 14, fF: 176, tN: 72, sN: 2, tF: 68, sF: 2 },
    ],
  },
  skullCrusher: {
    label: 'Skull crusher', duration: 2400, anchor: 'hip', at: [132, G - 40], props: ['bench', 'dumbbells'],
    frames: [
      { torso: -90, head: -95, aN: 190, fN: 190, aF: 186, fF: 186, tN: 72, sN: 2, tF: 68, sF: 2 },
      { torso: -90, head: -95, aN: 192, fN: 280, aF: 188, fF: 276, tN: 72, sN: 2, tF: 68, sF: 2 },
    ],
  },
  ohp: {
    label: 'Overhead press', duration: 2400, anchor: 'ground', at: GROUND_AT, props: ['barbell'],
    frames: [
      pose({ aN: 38, fN: 178, aF: 34, fF: 176 }),
      pose({ aN: 178, fN: 178, aF: 174, fF: 174 }),
    ],
  },
  dbPress: {
    label: 'Dumbbell press', duration: 2400, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ aN: 38, fN: 178, aF: 34, fF: 176 }),
      pose({ aN: 178, fN: 178, aF: 174, fF: 174 }),
    ],
  },
  row: {
    label: 'Bent-over row', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['barbell'],
    frames: [
      pose({ torso: 118, aN: 4, fN: 4, aF: 0, fF: 0, tN: 30, sN: -12, tF: 26, sF: -12 }),
      pose({ torso: 118, aN: -62, fN: 2, aF: -66, fF: -2, tN: 30, sN: -12, tF: 26, sF: -12 }),
    ],
  },
  dbRow: {
    label: 'Dumbbell row', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ torso: 115, aN: 4, fN: 4, aF: 0, fF: 0, tN: 30, sN: -12, tF: 26, sF: -12 }),
      pose({ torso: 115, aN: -62, fN: 2, aF: -66, fF: -2, tN: 30, sN: -12, tF: 26, sF: -12 }),
    ],
  },
  pullup: {
    label: 'Pull-up', duration: 2600, anchor: 'handN', at: [CX + 6, 20], props: ['pullBar'],
    frames: [
      pose({ aN: 176, fN: 176, aF: 172, fF: 172, tN: 8, sN: -22, tF: 4, sF: -26 }),
      pose({ aN: 28, fN: 172, aF: 24, fF: 168, tN: 14, sN: -24, tF: 10, sF: -28 }),
    ],
  },
  pulldown: {
    label: 'Lat pulldown', duration: 2400, anchor: 'hip', at: [CX - 6, G - 40], props: ['seat', 'cableTop'],
    frames: [
      pose({ torso: 190, aN: 172, fN: 172, aF: 168, fF: 168, tN: 90, sN: 2, tF: 86, sF: 2 }),
      pose({ torso: 194, aN: 30, fN: 170, aF: 26, fF: 166, tN: 90, sN: 2, tF: 86, sF: 2 }),
    ],
  },
  curl: {
    label: 'Biceps curl', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ aN: 6, fN: 6, aF: 2, fF: 2 }),
      pose({ aN: 12, fN: 150, aF: 8, fF: 146 }),
    ],
  },
  barbellCurl: {
    label: 'Barbell curl', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['barbell'],
    frames: [
      pose({ aN: 6, fN: 6, aF: 2, fF: 2 }),
      pose({ aN: 12, fN: 150, aF: 8, fF: 146 }),
    ],
  },
  pushdown: {
    label: 'Triceps pushdown', duration: 2000, anchor: 'ground', at: [CX - 10, GROUND], props: ['cableHigh'],
    frames: [
      pose({ torso: 172, aN: 8, fN: 150, aF: 4, fF: 146 }),
      pose({ torso: 172, aN: 8, fN: 4, aF: 4, fF: 0 }),
    ],
  },
  overheadExt: {
    label: 'Overhead extension', duration: 2400, anchor: 'ground', at: GROUND_AT, props: ['dumbbellOne'],
    frames: [
      pose({ aN: 172, fN: 176, aF: 168, fF: 172 }),
      pose({ aN: 170, fN: 300, aF: 166, fF: 296 }),
    ],
  },
  frontRaise: {
    label: 'Front raise', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ aN: 6, fN: 8, aF: 2, fF: 4 }),
      pose({ aN: 92, fN: 94, aF: 88, fF: 90 }),
    ],
  },
  shrug: {
    label: 'Shrug', duration: 1600, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ aN: 2, fN: 2, aF: -2, fF: -2 }),
      pose({ aN: 2, fN: 2, aF: -2, fF: -2, shrug: 10 }),
    ],
  },
  facePull: {
    label: 'Face pull', duration: 2200, anchor: 'ground', at: [CX - 14, GROUND], props: ['cableFront'],
    frames: [
      pose({ torso: 186, aN: 88, fN: 88, aF: 84, fF: 84 }),
      pose({ torso: 186, aN: -82, fN: 118, aF: -86, fF: 114 }),
    ],
  },
  straightArm: {
    label: 'Straight-arm pulldown', duration: 2200, anchor: 'ground', at: [CX - 14, GROUND], props: ['cableFrontHigh'],
    frames: [
      pose({ torso: 160, aN: 132, fN: 132, aF: 128, fF: 128, tN: 14, sN: -6, tF: 10, sF: -6 }),
      pose({ torso: 160, aN: 6, fN: 6, aF: 2, fF: 2, tN: 14, sN: -6, tF: 10, sF: -6 }),
    ],
  },
  cableRow: {
    label: 'Seated row', duration: 2400, anchor: 'hip', at: [CX - 20, G - 22], props: ['floorSeat', 'cableFrontLow'],
    frames: [
      { torso: 160, aN: 86, fN: 86, aF: 82, fF: 82, tN: 82, sN: 70, tF: 78, sF: 68, ftN: 170, ftF: 170 },
      { torso: 188, aN: -50, fN: 84, aF: -54, fF: 80, tN: 88, sN: 84, tF: 84, sF: 82, ftN: 170, ftF: 170 },
    ],
  },
  lunge: {
    label: 'Lunge', duration: 2600, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ aN: 2, fN: 2, aF: -2, fF: -2, tN: 40, sN: 4, tF: -36, sF: -49, ftF: 20 }),
      pose({ aN: 2, fN: 2, aF: -2, fF: -2, tN: 72, sN: 4, tF: -6, sF: -91, ftF: 20 }),
    ],
  },
  calfRaise: {
    label: 'Calf raise', duration: 1600, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      pose({ aN: 2, fN: 2, aF: -2, fF: -2 }),
      pose({ aN: 2, fN: 2, aF: -2, fF: -2, ftN: 40, ftF: 40 }),
    ],
  },
  hipThrust: {
    label: 'Hip thrust', duration: 2400, anchor: 'shoulder', at: [76, G - 46], props: ['benchLow', 'barbellHip'],
    frames: [
      { torso: -128, head: -110, aN: 30, fN: 101, tN: 118, sN: 24, tF: 116, sF: 24 },
      { torso: -92, head: -100, aN: 83, fN: 119, tN: 77, sN: 0, tF: 75, sF: 0 },
    ],
  },
  bridge: {
    label: 'Glute bridge', duration: 2200, anchor: 'shoulder', at: [86, G - 10], props: [],
    frames: [
      { torso: -92, head: -92, aN: 92, fN: 92, tN: 137, sN: 0, tF: 133, sF: 0 },
      { torso: -60, head: -70, aN: 104, fN: 92, tN: 92, sN: -6, tF: 88, sF: -6 },
    ],
  },
  plank: {
    label: 'Plank', duration: 3000, anchor: 'lowest', at: [CX + 10, GROUND], props: [],
    frames: [
      { torso: 97, head: 100, aN: 2, fN: 90, aF: -2, fF: 88, tN: -83, sN: -83, tF: -84, sF: -84, ftN: 0, ftF: 0 },
      { torso: 99, head: 102, aN: 2, fN: 90, aF: -2, fF: 88, tN: -81, sN: -81, tF: -82, sF: -82, ftN: 0, ftF: 0 },
    ],
  },
  pushup: {
    label: 'Push-up', duration: 2200, anchor: 'handN', at: [CX + 40, GROUND - 3], props: [],
    frames: [
      { torso: 112, head: 115, aN: 2, fN: 2, aF: -2, fF: -2, tN: -68, sN: -68, tF: -69, sF: -69, ftN: -5, ftF: -5 },
      { torso: 97, head: 100, aN: -55, fN: 12, aF: -58, fF: 8, tN: -83, sN: -83, tF: -84, sF: -84, ftN: -5, ftF: -5 },
    ],
  },
  crunch: {
    label: 'Crunch', duration: 2000, anchor: 'hip', at: [CX + 10, G - 12], props: [],
    frames: [
      { torso: -88, head: -95, aN: 92, fN: 92, tN: 130, sN: 4, tF: 126, sF: 4 },
      { torso: -122, head: -128, aN: 118, fN: 112, tN: 130, sN: 4, tF: 126, sF: 4 },
    ],
  },
  cableCrunch: {
    label: 'Cable crunch', duration: 2200, anchor: 'kneeN', at: [CX + 16, GROUND - 3], props: ['cableHigh'],
    frames: [
      { torso: 165, head: 160, aN: 150, fN: -40, tN: 10, sN: -88, tF: 8, sF: -88, ftN: -90, ftF: -90 },
      { torso: 105, head: 100, aN: 70, fN: 210, tN: 30, sN: -88, tF: 28, sF: -88, ftN: -90, ftF: -90 },
    ],
  },
  abWheel: {
    label: 'Ab wheel', duration: 2800, anchor: 'kneeN', at: [CX - 30, GROUND - 3], props: ['wheel'],
    frames: [
      { torso: 150, head: 150, aN: 4, fN: 4, aF: 0, fF: 0, tN: 6, sN: -88, tF: 4, sF: -88, ftN: -90, ftF: -90 },
      { torso: 100, head: 104, aN: 80, fN: 84, aF: 76, fF: 80, tN: 70, sN: -88, tF: 68, sF: -88, ftN: -90, ftF: -90 },
    ],
  },
  legRaise: {
    label: 'Hanging leg raise', duration: 2600, anchor: 'handN', at: [CX - 8, 20], props: ['pullBar'],
    frames: [
      pose({ aN: 178, fN: 178, aF: 174, fF: 174, tN: 4, sN: 2, tF: 0, sF: -2 }),
      pose({ torso: 184, aN: 178, fN: 178, aF: 174, fF: 174, tN: 90, sN: 92, tF: 86, sF: 88 }),
    ],
  },
  dip: {
    label: 'Dip', duration: 2400, anchor: 'handN', at: [CX + 4, G - 74], props: ['dipBars'],
    frames: [
      pose({ torso: 176, aN: 4, fN: 4, aF: 0, fF: 0, tN: 14, sN: -40, tF: 10, sF: -44 }),
      pose({ torso: 166, aN: -72, fN: 14, aF: -76, fF: 10, tN: 20, sN: -40, tF: 16, sF: -44 }),
    ],
  },
  nordic: {
    label: 'Nordic curl', duration: 3200, anchor: 'kneeN', at: [CX - 34, GROUND - 3], props: ['anchorPad'],
    frames: [
      { torso: 180, head: 180, aN: 40, fN: 120, aF: 36, fF: 116, tN: 0, sN: -90, tF: -2, sF: -90, ftN: 0, ftF: 0 },
      { torso: 118, head: 122, aN: 70, fN: 80, aF: 66, fF: 76, tN: -62, sN: -90, tF: -64, sF: -90, ftN: 0, ftF: 0 },
    ],
  },
  sprint: {
    label: 'Sprint', duration: 760, anchor: 'lowest', at: [CX, GROUND],
    frames: (() => {
      const a = pose({ torso: 165, aN: -50, fN: 40, aF: 55, fF: 140, tN: 70, sN: -12, tF: -32, sF: -70, ftN: 100, ftF: 20 });
      const b = pose({ torso: 165, aN: 5, fN: 90, aF: -5, fF: 80, tN: 15, sN: -40, tF: -5, sF: -10, ftN: 90, ftF: 60 });
      return [a, b, swapSides(a), swapSides(b)];
    })(),
  },
  shuttle: {
    label: 'Shuttle / COD', duration: 760, anchor: 'lowest', at: [CX, GROUND], props: ['cones'],
    frames: (() => {
      const a = pose({ torso: 160, aN: -50, fN: 40, aF: 55, fF: 140, tN: 70, sN: -12, tF: -32, sF: -70, ftN: 100, ftF: 20 });
      const b = pose({ torso: 160, aN: 5, fN: 90, aF: -5, fF: 80, tN: 15, sN: -40, tF: -5, sF: -10, ftN: 90, ftF: 60 });
      return [a, b, swapSides(a), swapSides(b)];
    })(),
  },
  ladder: {
    label: 'Agility ladder', duration: 480, anchor: 'lowest', at: [CX, GROUND], props: ['ladder'],
    frames: (() => {
      const a = pose({ torso: 170, aN: -30, fN: 60, aF: 30, fF: 120, tN: 50, sN: -20, tF: -8, sF: -20, ftN: 95, ftF: 60 });
      return [a, swapSides(a)];
    })(),
  },
  jumpRope: {
    label: 'Jump rope', duration: 700, anchor: 'ground', at: GROUND_AT, props: ['rope'],
    frames: [
      pose({ aN: 25, fN: 75, aF: 20, fF: 70, tN: 10, sN: -10, tF: 6, sF: -10, ftN: 60, ftF: 60, at: [CX, GROUND] }),
      pose({ aN: 25, fN: 75, aF: 20, fF: 70, tN: 4, sN: -4, tF: 0, sF: -4, ftN: 45, ftF: 45, at: [CX, GROUND - 10] }),
    ],
  },
  rowing: {
    label: 'Rowing machine', duration: 2400, anchor: 'ankleN', at: [CX + 40, GROUND - 16], props: ['rower'],
    frames: [
      { torso: 150, head: 155, aN: 92, fN: 92, aF: 88, fF: 88, tN: 128, sN: 20, tF: 124, sF: 18, ftN: 170, ftF: 170 },
      { torso: 200, head: 192, aN: -40, fN: 80, aF: -44, fF: 76, tN: 88, sN: 88, tF: 86, sF: 86, ftN: 170, ftF: 170 },
    ],
  },
  cycling: {
    label: 'Cycling', duration: 900, anchor: 'hip', at: [CX - 12, G - 54], props: ['bike'],
    frames: (() => {
      const a = { torso: 150, head: 140, aN: 105, fN: 120, tN: 115, sN: 10, tF: 45, sF: -20, ftN: 100, ftF: 80 };
      const b = { torso: 150, head: 140, aN: 105, fN: 120, tN: 80, sN: -15, tF: 80, sF: 15, ftN: 90, ftF: 90 };
      return [a, b, swapSides(a), swapSides(b)];
    })(),
  },
  jump: {
    label: 'Vertical jump', duration: 1800, anchor: 'ground', at: GROUND_AT,
    frames: [
      pose({ at: [CX, GROUND] }),
      pose({ torso: 140, aN: -60, fN: -50, aF: -64, fF: -54, tN: 75, sN: -25, tF: 71, sF: -25, at: [CX, GROUND] }),
      pose({ aN: 150, fN: 160, aF: 146, fF: 156, tN: 2, sN: -2, tF: -2, sF: -2, ftN: 30, ftF: 30, at: [CX, GROUND - 24] }),
      pose({ torso: 150, aN: 40, fN: 80, aF: 36, fF: 76, tN: 60, sN: -20, tF: 56, sF: -20, at: [CX, GROUND] }),
    ],
  },
  boxJump: {
    label: 'Box jump', duration: 2200, anchor: 'ground', at: [70, GROUND], props: ['box'], snap: true,
    frames: [
      pose({ at: [70, GROUND] }),
      pose({ torso: 140, aN: -60, fN: -50, aF: -64, fF: -54, tN: 75, sN: -25, tF: 71, sF: -25, at: [70, GROUND] }),
      pose({ aN: 160, fN: 170, aF: 156, fF: 166, tN: 80, sN: -10, tF: 76, sF: -10, at: [118, GROUND - 52] }),
      pose({ torso: 150, aN: 40, fN: 80, aF: 36, fF: 76, tN: 70, sN: -25, tF: 66, sF: -25, at: [150, GROUND - 36] }),
      pose({ at: [150, GROUND - 36] }),
    ],
  },
  broadJump: {
    label: 'Broad jump', duration: 2000, anchor: 'ground', at: [50, GROUND], snap: true,
    frames: [
      pose({ at: [50, GROUND] }),
      pose({ torso: 135, aN: -70, fN: -60, aF: -74, fF: -64, tN: 75, sN: -25, tF: 71, sF: -25, at: [50, GROUND] }),
      pose({ torso: 150, aN: 150, fN: 160, aF: 146, fF: 156, tN: 40, sN: -30, tF: 36, sF: -30, at: [110, GROUND - 26] }),
      pose({ torso: 145, aN: 70, fN: 90, aF: 66, fF: 86, tN: 80, sN: -20, tF: 76, sF: -20, at: [168, GROUND] }),
      pose({ at: [168, GROUND] }),
    ],
  },
  wallBall: {
    label: 'Med ball throw', duration: 2200, anchor: 'ground', at: [CX - 16, GROUND], props: ['ball', 'wall'],
    frames: [
      pose({ aN: 40, fN: 165, aF: 36, fF: 161 }),
      pose({ torso: 145, aN: 60, fN: 170, aF: 56, fF: 166, tN: 85, sN: -25, tF: 81, sF: -25 }),
      pose({ aN: 165, fN: 168, aF: 161, fF: 164, ftN: 60, ftF: 60 }),
    ],
  },
  legExtension: {
    label: 'Leg extension', duration: 2200, anchor: 'hip', at: [CX - 14, G - 46], props: ['machineSeat'],
    frames: [
      { torso: 184, aN: 40, fN: 5, tN: 88, sN: 6, tF: 86, sF: 4 },
      { torso: 184, aN: 40, fN: 5, tN: 88, sN: 84, tF: 86, sF: 82 },
    ],
  },
  legCurl: {
    label: 'Leg curl', duration: 2200, anchor: 'hip', at: [CX - 14, G - 46], props: ['machineSeat'],
    frames: [
      { torso: 186, aN: 40, fN: 5, tN: 88, sN: 82, tF: 86, sF: 80 },
      { torso: 186, aN: 40, fN: 5, tN: 88, sN: -8, tF: 86, sF: -10 },
    ],
  },
  legPress: {
    label: 'Leg press', duration: 2400, anchor: 'hip', at: [74, G - 30], props: ['pressSeat', 'platform'],
    frames: [
      { torso: 232, head: 222, aN: 120, fN: 60, tN: 162, sN: 52, tF: 158, sF: 50, ftN: 150, ftF: 150 },
      { torso: 232, head: 222, aN: 120, fN: 60, tN: 128, sN: 120, tF: 124, sF: 116, ftN: 150, ftF: 150 },
    ],
  },
  // ---- Frontansicht ----
  lateralRaise: {
    label: 'Lateral raise', view: 'front', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      { aR: 8, fR: 10, tR: 3, sR: 0 },
      { aR: 88, fR: 92, tR: 3, sR: 0 },
    ],
  },
  rearDelt: {
    label: 'Rear delt fly', view: 'front', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['dumbbells'],
    frames: [
      { lean: 0, aR: 6, fR: 8, tR: 8, sR: -4 },
      { lean: 0, aR: 78, fR: 84, tR: 8, sR: -4 },
    ],
  },
  fly: {
    label: 'Chest fly', view: 'front', duration: 2400, anchor: 'hip', at: [CX, G - 46], props: ['frontSeat'],
    frames: [
      { aR: 88, fR: 100, tR: 30, sR: -20, thighScale: 0.45 },
      { aR: 24, fR: -10, tR: 30, sR: -20, thighScale: 0.45 },
    ],
  },
  abduction: {
    label: 'Hip abduction', view: 'front', duration: 2200, anchor: 'hip', at: [CX, G - 50], props: ['frontSeat'],
    frames: [
      { aR: 22, fR: 6, tR: 12, sR: 2, thighScale: 0.45 },
      { aR: 22, fR: 6, tR: 52, sR: 26, thighScale: 0.45 },
    ],
  },
  adduction: {
    label: 'Hip adduction', view: 'front', duration: 2200, anchor: 'hip', at: [CX, G - 50], props: ['frontSeat'],
    frames: [
      { aR: 22, fR: 6, tR: 52, sR: 26, thighScale: 0.45 },
      { aR: 22, fR: 6, tR: 12, sR: 2, thighScale: 0.45 },
    ],
  },
  twist: {
    label: 'Rotation', view: 'front', duration: 2000, anchor: 'hip', at: [CX, G - 30], props: [],
    frames: [
      { lean: -12, aR: 55, fR: 85, aL: -20, fL: -50, tR: 60, sR: -10, thighScale: 0.5 },
      { lean: 12, aR: -20, fR: -50, aL: 55, fL: 85, tR: 60, sR: -10, thighScale: 0.5 },
    ],
  },
  woodchop: {
    label: 'Woodchopper', view: 'front', duration: 2200, anchor: 'ground', at: GROUND_AT, props: ['cableChop'],
    frames: [
      { lean: -12, aR: 150, fR: 160, aL: -100, fL: -110, tR: 12, sR: -4 },
      { lean: 10, aR: 30, fR: 20, aL: -10, fL: 10, tR: 12, sR: -4 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Zuordnung Übung -> Bewegung, Technik-Hinweise
// ---------------------------------------------------------------------------

/** Standard-Katalog (IDs aus AppDbContext.SeedExercises). */
export const EXERCISE_MOTION: Record<number, string | null> = {
  1: 'bench', 2: 'legExtension', 3: 'legCurl', 4: 'calfRaise', 5: 'abduction', 6: 'adduction', 7: 'legPress',
  8: 'pushdown', 9: 'barbellCurl', 10: null, 11: null, 12: 'sprint', 13: 'curl', 14: 'cableRow', 15: 'curl',
  16: 'skullCrusher', 17: 'pullup', 18: 'bench', 19: 'lateralRaise', 20: 'dip', 21: 'calfRaise', 22: 'barbellCurl',
  23: 'pulldown', 24: 'pushdown', 25: 'overheadExt', 26: 'row', 27: 'rearDelt', 28: 'pulldown', 29: 'deadlift',
  30: 'dbBench', 31: 'row', 32: 'wallBall', 33: 'lunge', 34: 'broadJump', 35: 'squat', 36: 'dbRow', 37: 'gobletSquat',
  38: 'dbRow', 39: 'bridge', 40: 'dbPress', 41: 'lunge', 42: 'deadlift', 43: 'curl', 44: 'pulldown', 45: 'dbRow',
  46: 'pushup', 47: 'plank', 48: 'plank', 49: 'rdl', 50: 'nordic', 51: 'boxJump', 52: 'jump', 53: 'twist',
  54: 'woodchop', 55: 'legRaise', 56: 'ladder', 57: 'shuttle', 58: 'shuttle', 59: 'inclineBench', 60: 'inclineBench',
  61: 'fly', 62: 'fly', 63: 'deadlift', 64: 'row', 65: 'pullup', 66: 'straightArm', 67: 'rdl', 68: 'ohp',
  69: 'lateralRaise', 70: 'frontRaise', 71: 'facePull', 72: 'shrug', 73: 'squat', 74: 'squat', 75: 'hipThrust',
  76: 'lunge', 77: 'barbellCurl', 78: 'bench', 79: 'cableCrunch', 80: 'abWheel', 81: 'crunch', 82: 'jumpRope',
  83: 'rowing', 84: 'cycling',
};

/** Erkennung für eigene Übungen über den Namen (Reihenfolge = Priorität). */
const KEYWORDS: [RegExp, string][] = [
  [/nordic/i, 'nordic'], [/hip thrust/i, 'hipThrust'], [/bridge/i, 'bridge'],
  [/skull/i, 'skullCrusher'], [/pushdown|push-down/i, 'pushdown'], [/overhead.*(ext|tricep)|french press/i, 'overheadExt'],
  [/incline/i, 'inclineBench'], [/bench|chest press|floor press/i, 'bench'], [/fly|crossover|pec deck/i, 'fly'],
  [/push[- ]?up|liegestütz/i, 'pushup'], [/pull[- ]?up|chin[- ]?up|klimmzug/i, 'pullup'], [/pulldown|lat pull/i, 'pulldown'],
  [/face pull/i, 'facePull'], [/straight[- ]arm/i, 'straightArm'], [/seated.*row|cable row/i, 'cableRow'],
  [/dumbbell.*row|one[- ]arm.*row|single[- ]arm.*row/i, 'dbRow'], [/row(?!ing)|rudern/i, 'row'],
  [/rowing|ergometer|ruderger/i, 'rowing'], [/romanian|rdl|good morning|back extension|hyperext/i, 'rdl'],
  [/dead ?lift|kreuzheben/i, 'deadlift'], [/goblet/i, 'gobletSquat'], [/leg press|beinpresse/i, 'legPress'],
  [/lunge|split squat|ausfallschritt|step[- ]?up/i, 'lunge'], [/squat|kniebeuge/i, 'squat'],
  [/leg ext|beinstrecker/i, 'legExtension'], [/leg curl|beinbeuger/i, 'legCurl'], [/calf|wade/i, 'calfRaise'],
  [/abduct/i, 'abduction'], [/adduct/i, 'adduction'],
  [/military|overhead press|shoulder press|ohp|schulterdrücken/i, 'ohp'], [/lateral raise|seitheben/i, 'lateralRaise'],
  [/front raise|frontheben/i, 'frontRaise'], [/rear delt|reverse fly/i, 'rearDelt'], [/shrug/i, 'shrug'],
  [/barbell curl|ez.?bar|preacher/i, 'barbellCurl'], [/curl/i, 'curl'], [/dip/i, 'dip'],
  [/plank|stütz/i, 'plank'], [/cable crunch/i, 'cableCrunch'], [/crunch|sit[- ]?up/i, 'crunch'],
  [/ab wheel|rollout/i, 'abWheel'], [/leg raise|knee raise|beinheben/i, 'legRaise'],
  [/twist/i, 'twist'], [/woodchop|chop/i, 'woodchop'], [/wall ?ball|med.?ball|slam/i, 'wallBall'],
  [/box jump/i, 'boxJump'], [/broad jump|long jump|weitsprung/i, 'broadJump'], [/jump rope|skipping|seilspring/i, 'jumpRope'],
  [/jump|sprung|plyo/i, 'jump'], [/ladder|leiter/i, 'ladder'], [/shuttle|cone|cod|change of direction|richtungswechsel/i, 'shuttle'],
  [/sprint|run|lauf|jog/i, 'sprint'], [/cycl|bike|fahrrad|rad/i, 'cycling'],
];

/** Übungen ohne Animation, aber mit Technik-Hinweisen. */
const EXERCISE_TECHNIQUE_ONLY: Record<number, string> = { 10: 'wristCurl', 11: 'wristCurl' };

type ExerciseLike = { id?: number; name?: Exercise['name']; isCustom?: boolean; trackingType?: TrackingType };

export function motionFor(exercise: ExerciseLike | null | undefined): string | null {
  if (!exercise) return null;
  if (exercise.id && !exercise.isCustom && exercise.id in EXERCISE_MOTION) return EXERCISE_MOTION[exercise.id];
  const name = exercise.name ?? '';
  for (const [re, key] of KEYWORDS) if (re.test(name)) return key;
  if (exercise.trackingType === 'DistanceTime') return 'sprint';
  return null;
}

/** Bewegung + Technik-Hinweise für eine Übung (beides kann null sein). */
export function techniqueFor(exercise: ExerciseLike | null | undefined): { motion: string | null; technique: Technique | null } {
  const motion = motionFor(exercise);
  const key = motion ?? (exercise?.id && !exercise.isCustom ? EXERCISE_TECHNIQUE_ONLY[exercise.id] : null) ?? null;
  return { motion, technique: key ? TECHNIQUE[key] ?? null : null };
}

/** Technik-Hinweise und Zielmuskulatur pro Bewegungsmuster. */
export const TECHNIQUE: Record<string, Technique> = {
  wristCurl: { muscles: ['Forearms', 'Grip'], cues: ['Forearms rest on the thighs or a bench', 'Only the wrists move', 'Full range, slow and controlled'] },
  squat: { muscles: ['Quads', 'Glutes', 'Adductors', 'Core'], cues: ['Bar on upper back, feet shoulder-width', 'Brace your core before each rep', 'Knees track over toes, hips to knee height or lower', 'Drive up through the whole foot'] },
  gobletSquat: { muscles: ['Quads', 'Glutes', 'Core'], cues: ['Hold the weight at chest height', 'Sit down between your knees', 'Keep chest up and heels on the floor'] },
  deadlift: { muscles: ['Glutes', 'Hamstrings', 'Lower back', 'Traps'], cues: ['Bar over mid-foot, shins close to the bar', 'Neutral spine - brace, then push the floor away', 'Hips and shoulders rise together', 'Lock out with glutes, do not lean back'] },
  rdl: { muscles: ['Hamstrings', 'Glutes', 'Lower back'], cues: ['Soft knees, push the hips back', 'Weight slides along the thighs', 'Stop when you feel the hamstring stretch', 'Back stays flat'] },
  bench: { muscles: ['Chest', 'Triceps', 'Front delts'], cues: ['Shoulder blades pulled back and down', 'Feet planted, slight arch', 'Lower to mid-chest, elbows ~45°', 'Press up and slightly back'] },
  inclineBench: { muscles: ['Upper chest', 'Front delts', 'Triceps'], cues: ['Bench at 30-45°', 'Lower to upper chest', 'Keep wrists stacked over elbows'] },
  dbBench: { muscles: ['Chest', 'Triceps', 'Front delts'], cues: ['Dumbbells over the chest at the top', 'Lower slowly to chest level', 'Press up and slightly together'] },
  skullCrusher: { muscles: ['Triceps'], cues: ['Upper arms stay still and vertical', 'Lower the weight towards your forehead', 'Extend fully without locking hard'] },
  ohp: { muscles: ['Shoulders', 'Triceps', 'Upper chest', 'Core'], cues: ['Squeeze glutes and brace - no leaning back', 'Bar starts on the front of the shoulders', 'Press straight up, head moves through at the top'] },
  dbPress: { muscles: ['Shoulders', 'Triceps'], cues: ['Start at ear height, palms forward', 'Press up without arching your back', 'Control the way down'] },
  row: { muscles: ['Lats', 'Upper back', 'Rear delts', 'Biceps'], cues: ['Hinge forward, back flat', 'Pull to the lower ribs', 'Squeeze shoulder blades together at the top'] },
  dbRow: { muscles: ['Lats', 'Upper back', 'Biceps'], cues: ['Support yourself, back flat', 'Pull elbow towards the hip', 'Lower until the arm is straight'] },
  pullup: { muscles: ['Lats', 'Biceps', 'Upper back'], cues: ['Start from a dead hang', 'Pull the chest to the bar, elbows down', 'No swinging - control the descent'] },
  pulldown: { muscles: ['Lats', 'Biceps', 'Upper back'], cues: ['Lean back slightly, chest up', 'Pull the bar to the upper chest', 'Let the arms extend fully at the top'] },
  curl: { muscles: ['Biceps', 'Forearms'], cues: ['Elbows stay pinned to your sides', 'Curl up without swinging', 'Lower slowly (2-3 s)'] },
  barbellCurl: { muscles: ['Biceps', 'Forearms'], cues: ['Shoulder-width grip', 'Elbows stay still', 'Full range: straight arm to full squeeze'] },
  pushdown: { muscles: ['Triceps'], cues: ['Elbows fixed at your sides', 'Push down until arms are straight', 'Only the forearms move'] },
  overheadExt: { muscles: ['Triceps (long head)'], cues: ['Elbows point up and stay narrow', 'Lower the weight behind your head', 'Extend fully overhead'] },
  frontRaise: { muscles: ['Front delts'], cues: ['Slight bend in the elbows', 'Raise to shoulder height', 'No momentum from the hips'] },
  lateralRaise: { muscles: ['Side delts'], cues: ['Lead with the elbows', 'Raise to shoulder height, not higher', 'Lower slowly'] },
  rearDelt: { muscles: ['Rear delts', 'Upper back'], cues: ['Hinge forward or use the machine pad', 'Open the arms wide, slight elbow bend', 'Squeeze the back of the shoulders'] },
  shrug: { muscles: ['Traps'], cues: ['Arms stay straight', 'Lift shoulders straight up to the ears', 'Pause at the top'] },
  facePull: { muscles: ['Rear delts', 'Upper back', 'Rotator cuff'], cues: ['Rope at face height', 'Pull towards the forehead, elbows high', 'Rotate hands back at the end'] },
  straightArm: { muscles: ['Lats', 'Core'], cues: ['Arms almost straight', 'Pull the bar down to the thighs', 'Keep the torso still'] },
  cableRow: { muscles: ['Mid back', 'Lats', 'Biceps'], cues: ['Sit tall, knees slightly bent', 'Pull the handle to the belly', 'Do not rock the torso'] },
  lunge: { muscles: ['Quads', 'Glutes', 'Hamstrings'], cues: ['Long stride, torso upright', 'Back knee almost touches the floor', 'Push through the front heel'] },
  calfRaise: { muscles: ['Calves'], cues: ['Full stretch at the bottom', 'Rise onto the balls of the feet', 'Pause 1 s at the top'] },
  hipThrust: { muscles: ['Glutes', 'Hamstrings'], cues: ['Upper back on the bench', 'Drive hips up until body is straight', 'Chin tucked, squeeze glutes at the top'] },
  bridge: { muscles: ['Glutes', 'Hamstrings', 'Core'], cues: ['Feet flat, close to the glutes', 'Push hips up through the heels', 'Do not overarch the lower back'] },
  plank: { muscles: ['Core', 'Shoulders'], cues: ['Elbows under the shoulders', 'Straight line from head to heels', 'Squeeze glutes and breathe'] },
  pushup: { muscles: ['Chest', 'Triceps', 'Shoulders', 'Core'], cues: ['Hands slightly wider than shoulders', 'Body stays one straight line', 'Chest to the floor, elbows ~45°'] },
  crunch: { muscles: ['Abs'], cues: ['Lower back stays on the floor', 'Curl the ribs towards the pelvis', 'Do not pull on the neck'] },
  cableCrunch: { muscles: ['Abs'], cues: ['Kneel, rope next to the head', 'Round the spine down towards the knees', 'Hips stay still'] },
  abWheel: { muscles: ['Abs', 'Lats', 'Shoulders'], cues: ['Start on the knees, arms straight', 'Roll out as far as you can control', 'Keep the lower back from sagging'] },
  legRaise: { muscles: ['Lower abs', 'Hip flexors'], cues: ['Hang still, no swinging', 'Raise legs to hip height or higher', 'Lower slowly'] },
  dip: { muscles: ['Chest', 'Triceps', 'Front delts'], cues: ['Shoulders down, chest up', 'Lower until upper arms are parallel to the floor', 'Press up to straight arms'] },
  nordic: { muscles: ['Hamstrings'], cues: ['Heels locked, hips straight', 'Fall forward as slowly as possible', 'Catch yourself with the hands, push back up'] },
  sprint: { muscles: ['Hamstrings', 'Glutes', 'Calves', 'Hip flexors'], cues: ['Lean forward during acceleration', 'Drive knees up, punch arms', 'Land on the balls of the feet', 'Full rest between sprints'] },
  shuttle: { muscles: ['Legs', 'Glutes', 'Core'], cues: ['Lower the hips before the turn', 'Plant the outside foot, push off hard', 'Eyes up, short quick steps'] },
  ladder: { muscles: ['Calves', 'Hip flexors', 'Coordination'], cues: ['Stay on the balls of the feet', 'Quick, light contacts', 'Arms move with the legs'] },
  jumpRope: { muscles: ['Calves', 'Shoulders', 'Conditioning'], cues: ['Small jumps, 2-3 cm off the floor', 'Turn the rope with the wrists', 'Stay relaxed and rhythmic'] },
  rowing: { muscles: ['Legs', 'Back', 'Arms', 'Conditioning'], cues: ['Order: legs - body - arms', 'Return: arms - body - legs', 'Power comes from the legs'] },
  cycling: { muscles: ['Quads', 'Glutes', 'Conditioning'], cues: ['Saddle height: slight knee bend at the bottom', 'Smooth, round pedal strokes', 'Keep the upper body relaxed'] },
  jump: { muscles: ['Glutes', 'Quads', 'Calves'], cues: ['Quick dip, swing the arms', 'Explode up through the hips', 'Land soft with bent knees'] },
  boxJump: { muscles: ['Glutes', 'Quads', 'Calves'], cues: ['Swing arms and jump up onto the box', 'Land soft in a half squat', 'Step down - do not jump down'] },
  broadJump: { muscles: ['Glutes', 'Hamstrings', 'Quads'], cues: ['Load the hips, swing arms back', 'Jump forward and up', 'Stick the landing, knees over toes'] },
  wallBall: { muscles: ['Legs', 'Shoulders', 'Core'], cues: ['Ball at chest, squat down', 'Use the leg drive to throw', 'Catch and go straight into the next squat'] },
  legExtension: { muscles: ['Quads'], cues: ['Pad on the lower shin', 'Extend until legs are straight', 'Lower slowly, do not let the weight drop'] },
  legCurl: { muscles: ['Hamstrings'], cues: ['Knees in line with the machine axis', 'Curl the heels under the seat', 'Control the way back'] },
  legPress: { muscles: ['Quads', 'Glutes'], cues: ['Feet shoulder-width on the platform', 'Lower until knees are ~90°', 'Do not lock the knees at the top'] },
  fly: { muscles: ['Chest', 'Front delts'], cues: ['Slight bend in the elbows, keep it fixed', 'Open until you feel a chest stretch', 'Bring hands together in front of the chest'] },
  abduction: { muscles: ['Glute medius', 'Hip abductors'], cues: ['Sit tall, back against the pad', 'Push the knees outwards', 'Return slowly'] },
  adduction: { muscles: ['Adductors'], cues: ['Sit tall, back against the pad', 'Squeeze the knees together', 'Control the opening'] },
  twist: { muscles: ['Obliques', 'Abs'], cues: ['Lean back slightly, chest up', 'Rotate the shoulders, not only the arms', 'Feet on the floor for beginners'] },
  woodchop: { muscles: ['Obliques', 'Core', 'Shoulders'], cues: ['Arms almost straight', 'Rotate through the torso diagonally', 'Pivot on the back foot'] },
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const FIELDS = POSE_FIELDS;

function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const f of FIELDS) {
    if (a[f] === undefined && b[f] === undefined) continue;
    const va = a[f] ?? b[f];
    const vb = b[f] ?? a[f];
    out[f] = lerp(va, vb, t);
  }
  return out;
}

/** Pose + Ankerziel zum Zeitpunkt `phase` (0..1) einer Bewegung. */
export function sampleMotion(motion: Motion, phase: number): { pose: Pose; at: Pt } {
  const frames = motion.frames;
  const n = frames.length;
  const segments = motion.snap ? n - 1 : n;
  const pos = (((phase % 1) + 1) % 1) * (motion.snap ? n : n);
  let i = Math.floor(pos);
  let t = pos - i;
  if (motion.snap && i >= segments) {
    // Haltephase am Ende, dann Sprung zurück zum ersten Frame
    i = n - 1;
    t = 0;
  }
  const a = frames[i % n];
  const b = frames[(i + 1) % n];
  const e = ease(t);
  const at0 = a.at ?? motion.at;
  const at1 = b.at ?? motion.at;
  return { pose: interpolatePose(a, b, e), at: [lerp(at0[0], at1[0], e), lerp(at0[1], at1[1], e)] };
}

export function buildSkeleton(motion: Motion, phase: number): Skeleton {
  const { pose: p, at } = sampleMotion(motion, phase);
  const raw = motion.view === 'front' ? frontSkeleton(p) : sideSkeleton(p);
  return anchorSkeleton(raw, motion.anchor ?? 'ground', at);
}

const f1 = (n: number) => Math.round(n * 10) / 10;
const line = (a: Pt, b: Pt, cls: string) => `<line class="${cls}" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`;
const circle = (c: Pt, r: number, cls: string) => `<circle class="${cls}" cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}"/>`;
const rect = (x: number, y: number, w: number, h: number, cls: string, rx = 3) => `<rect class="${cls}" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${rx}"/>`;

function renderProp(name: string, s: Skeleton, phase: number): string {
  const hm = mid(s.handN, s.handF);
  switch (name) {
    case 'barbell': return circle(hm, 10, 'fx-plate') + circle(hm, 3, 'fx-hub');
    case 'barbellBack': { const p = add(s.shoulder, [-3, 2]); return circle(p, 10, 'fx-plate') + circle(p, 3, 'fx-hub'); }
    case 'barbellHip': return circle(add(s.hip, [0, -10]), 10, 'fx-plate') + circle(add(s.hip, [0, -10]), 3, 'fx-hub');
    case 'dumbbells': return [s.handN, s.handF].map((h) => rect(h[0] - 6, h[1] - 3.5, 12, 7, 'fx-db', 2)).join('');
    case 'dumbbellOne': return rect(hm[0] - 7, hm[1] - 4, 14, 8, 'fx-db', 2);
    case 'dumbbellChest': return rect(hm[0] - 6, hm[1] - 6, 12, 12, 'fx-db', 3);
    case 'ball': return circle(add(hm, [0, -4]), 8, 'fx-ball');
    case 'ballFront': return circle(hm, 7, 'fx-ball');
    case 'wheel': return circle(add(hm, [0, 4]), 7, 'fx-plate') + circle(add(hm, [0, 4]), 2, 'fx-hub');
    case 'bench': return rect(48, G - 36, 96, 8, 'fx-gear') + rect(60, G - 28, 6, 28, 'fx-gear', 1) + rect(126, G - 28, 6, 28, 'fx-gear', 1);
    case 'benchIncline': return `<polygon class="fx-gear" points="56,${G - 62} 70,${G - 68} 140,${G - 38} 140,${G - 30}"/>` + rect(122, G - 34, 6, 34, 'fx-gear', 1) + rect(66, G - 62, 6, 62, 'fx-gear', 1);
    case 'benchLow': return rect(40, G - 42, 44, 8, 'fx-gear') + rect(52, G - 34, 6, 34, 'fx-gear', 1);
    case 'seat': case 'machineSeat': return rect(s.hip[0] - 18, s.hip[1] + 4, 40, 7, 'fx-gear') + rect(s.hip[0] - 2, s.hip[1] + 11, 6, GROUND - s.hip[1] - 11, 'fx-gear', 1)
      + (name === 'machineSeat' ? rect(s.hip[0] - 26, s.hip[1] - 50, 7, 54, 'fx-gear') : '');
    case 'floorSeat': return rect(s.hip[0] - 16, s.hip[1] + 4, 34, GROUND - s.hip[1] - 4, 'fx-gear');
    case 'pressSeat': return `<polygon class="fx-gear" points="30,${G - 54} 50,${G - 8} 104,${G - 18} 96,${G - 30}"/>` + rect(40, G - 8, 70, 8, 'fx-gear', 1);
    case 'platform': { const a = mid(s.ankleN, s.toeN); return `<line class="fx-cable-thick" x1="${f1(a[0] - 12)}" y1="${f1(a[1] + 14)}" x2="${f1(a[0] + 10)}" y2="${f1(a[1] - 16)}"/>`; }
    case 'frontSeat': return rect(s.hip[0] - 26, s.hip[1] + 4, 52, 7, 'fx-gear') + rect(s.hip[0] - 3, s.hip[1] + 11, 6, GROUND - s.hip[1] - 11, 'fx-gear', 1)
      + rect(s.hip[0] - 20, s.hip[1] - 52, 40, 54, 'fx-gear-soft');
    case 'pullBar': { const y = Math.min(s.handN[1], s.handF[1]) - 1; return line([CX - 50, y], [CX + 50, y], 'fx-bar'); }
    case 'dipBars': return line([s.handN[0] - 26, s.handN[1] + 1], [s.handN[0] + 26, s.handN[1] + 1], 'fx-bar') + line([s.handN[0] + 20, s.handN[1] + 1], [s.handN[0] + 20, GROUND], 'fx-gear-line');
    case 'cableTop': return line([s.hip[0] + 6, 6], hm, 'fx-cable') + circle([s.hip[0] + 6, 6], 4, 'fx-hub');
    case 'cableHigh': { const px = s.shoulder[0] + 16; return line([px, 10], s.handN, 'fx-cable') + circle([px, 10], 4, 'fx-hub'); }
    case 'cableFront': return line([W - 12, s.shoulder[1] - 4], hm, 'fx-cable') + rect(W - 16, 10, 8, GROUND - 10, 'fx-gear', 1);
    case 'cableFrontHigh': return line([W - 12, 22], hm, 'fx-cable') + rect(W - 16, 10, 8, GROUND - 10, 'fx-gear', 1);
    case 'cableFrontLow': return line([W - 12, s.hip[1] - 14], hm, 'fx-cable') + rect(W - 16, 60, 8, GROUND - 60, 'fx-gear', 1);
    case 'cableChop': return line([CX - 70, 14], s.handN, 'fx-cable') + circle([CX - 70, 14], 4, 'fx-hub');
    case 'box': return rect(128, GROUND - 36, 56, 36, 'fx-gear', 2);
    case 'wall': return rect(W - 14, 0, 8, GROUND, 'fx-gear', 0);
    case 'anchorPad': return rect(s.ankleN[0] - 12, s.ankleN[1] - 12, 18, 9, 'fx-gear');
    case 'rower': return rect(30, GROUND - 6, 160, 6, 'fx-gear', 2) + rect(s.hip[0] - 12, s.hip[1] + 4, 26, 6, 'fx-gear') + rect(W - 44, GROUND - 40, 10, 34, 'fx-gear') + line([W - 40, GROUND - 34], hm, 'fx-cable');
    case 'bike': {
      const crank: Pt = [s.hip[0] + 30, s.hip[1] + 50];
      const bar: Pt = [s.hip[0] + 58, s.hip[1] - 14];
      return rect(s.hip[0] - 12, s.hip[1] + 3, 26, 6, 'fx-gear')
        + line([s.hip[0], s.hip[1] + 9], [crank[0], crank[1]], 'fx-gear-line')
        + line([crank[0], crank[1]], bar, 'fx-gear-line') + line(bar, [bar[0] + 8, bar[1] - 2], 'fx-gear-line')
        + circle(crank, 16, 'fx-wheel') + line([crank[0] - 30, GROUND], [crank[0] + 50, GROUND], 'fx-gear-line');
    }
    case 'cones': return [40, 180].map((x) => `<polygon class="fx-cone" points="${x - 6},${GROUND} ${x + 6},${GROUND} ${x},${GROUND - 14}"/>`).join('');
    case 'ladder': return line([20, GROUND - 1], [200, GROUND - 1], 'fx-gear-line') + [30, 60, 90, 120, 150, 180].map((x) => line([x, GROUND - 4], [x + 10, GROUND + 2], 'fx-gear-line')).join('');
    case 'rope': {
      // Das Seil kreist in der Seitenansicht um den Körper (über den Kopf, unter den Füßen durch).
      const a = phase * Math.PI * 2;
      const c: Pt = [s.hip[0] + 2, (s.head[1] + GROUND) / 2];
      const ry = (GROUND - s.head[1]) / 2 + 10;
      const P: Pt = [c[0] + Math.sin(a) * 30, c[1] - Math.cos(a) * ry];
      const curve = (h: Pt, bend: number) => {
        const m = mid(h, P);
        const dx = P[0] - h[0];
        const dy = P[1] - h[1];
        const len = Math.hypot(dx, dy) || 1;
        const C: Pt = [m[0] - (dy / len) * bend, m[1] + (dx / len) * bend];
        return `M ${f1(h[0])} ${f1(h[1])} Q ${f1(C[0])} ${f1(C[1])} ${f1(P[0])} ${f1(P[1])}`;
      };
      return `<path class="fx-cable" fill="none" d="${curve(s.handN, 14)} ${curve(s.handF, -14)}"/>`;
    }
    default: return '';
  }
}

const BACK_PROPS = new Set(['bench', 'benchIncline', 'benchLow', 'seat', 'machineSeat', 'floorSeat', 'pressSeat', 'frontSeat',
  'pullBar', 'dipBars', 'box', 'wall', 'anchorPad', 'rower', 'bike', 'cones', 'ladder', 'cableTop', 'cableHigh', 'cableFront',
  'cableFrontHigh', 'cableFrontLow', 'cableChop', 'platform']);

/** Komplettes SVG der Bewegung zum Zeitpunkt `phase` (0..1). */
export function renderFigureSvg(key: string | null | undefined, phase = 0, { title = '' } = {}): string {
  const motion = key ? MOTIONS[key] : undefined;
  if (!motion) return '';
  const s = buildSkeleton(motion, phase);
  const props = motion.props ?? [];
  const back = props.filter((p) => BACK_PROPS.has(p)).map((p) => renderProp(p, s, phase)).join('');
  const front = props.filter((p) => !BACK_PROPS.has(p)).map((p) => renderProp(p, s, phase)).join('');
  const shadowX = motion.view === 'front' ? s.hip[0] : mid(s.ankleN, s.ankleF)[0];
  const airborne = Math.max(0, GROUND - 3 - Math.max(s.ankleN[1], s.ankleF[1], s.toeN[1], s.toeF[1]));
  const shadowW = Math.max(10, 26 - airborne * 0.3);

  let body: string;
  if (motion.view === 'front') {
    body = [
      line(s.hipL, s.kneeF, 'fx-limb'), line(s.kneeF, s.ankleF, 'fx-limb'), line(s.ankleF, s.toeF, 'fx-limb'),
      line(s.shL, s.elbowF, 'fx-limb'), line(s.elbowF, s.handF, 'fx-limb'),
      line(s.hipL, s.hipR, 'fx-limb'), line(s.shL, s.shR, 'fx-limb'), line(s.hip, s.shoulder, 'fx-torso'),
      line(s.hipR, s.kneeN, 'fx-limb'), line(s.kneeN, s.ankleN, 'fx-limb'), line(s.ankleN, s.toeN, 'fx-limb'),
      line(s.shR, s.elbowN, 'fx-limb'), line(s.elbowN, s.handN, 'fx-limb'),
      line(s.shoulder, s.neck, 'fx-limb'), circle(s.head, L.head, 'fx-head'),
    ].join('');
  } else {
    body = [
      // ferne Seite (gedimmt)
      line(s.hip, s.kneeF, 'fx-limb fx-far'), line(s.kneeF, s.ankleF, 'fx-limb fx-far'), line(s.ankleF, s.toeF, 'fx-limb fx-far'),
      line(s.shoulder, s.elbowF, 'fx-limb fx-far'), line(s.elbowF, s.handF, 'fx-limb fx-far'),
      // Rumpf + Kopf
      line(s.hip, s.shoulder, 'fx-torso'), line(s.shoulder, s.neck, 'fx-limb'), circle(s.head, L.head, 'fx-head'),
      // nahe Seite
      line(s.hip, s.kneeN, 'fx-limb'), line(s.kneeN, s.ankleN, 'fx-limb'), line(s.ankleN, s.toeN, 'fx-limb'),
      line(s.shoulder, s.elbowN, 'fx-limb'), line(s.elbowN, s.handN, 'fx-limb'),
      circle(s.kneeN, 2.2, 'fx-joint'), circle(s.elbowN, 2.2, 'fx-joint'), circle(s.hip, 2.6, 'fx-joint'),
    ].join('');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${VIEW.H}" class="fx-svg" role="img" aria-label="${title || motion.label}">`
    + `<line class="fx-ground" x1="8" y1="${GROUND}" x2="${W - 8}" y2="${GROUND}"/>`
    + `<ellipse class="fx-shadow" cx="${f1(shadowX)}" cy="${GROUND + 2}" rx="${f1(shadowW)}" ry="3"/>`
    + back + body + front + '</svg>';
}
