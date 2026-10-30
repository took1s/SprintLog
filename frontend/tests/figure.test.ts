import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOTIONS, TECHNIQUE, EXERCISE_MOTION, motionFor, techniqueFor, renderFigureSvg, buildSkeleton, VIEW } from '../src/lib/figure';

const seedIds = [...readFileSync(new URL('../../SprintLog.Api/Data/AppDbContext.cs', import.meta.url), 'utf8')
  .matchAll(/Ex\((\d+), "/g)].map((m) => Number(m[1]));

test('every seeded exercise has an entry in the motion map', () => {
  assert.equal(seedIds.length, 257);
  for (const id of seedIds) assert.ok(id in EXERCISE_MOTION, `exercise ${id} missing in EXERCISE_MOTION`);
});

test('every mapped motion exists and has technique cues', () => {
  for (const [id, key] of Object.entries(EXERCISE_MOTION)) {
    if (key === null) continue;
    assert.ok(MOTIONS[key], `exercise ${id}: motion "${key}" not defined`);
  }
  for (const key of Object.keys(MOTIONS)) {
    assert.ok(TECHNIQUE[key]?.cues?.length >= 3, `motion "${key}" needs at least 3 cues`);
    assert.ok(TECHNIQUE[key]?.muscles?.length >= 1, `motion "${key}" needs muscles`);
  }
});

test('every seeded exercise gets at least technique cues', () => {
  for (const id of seedIds) {
    const { technique } = techniqueFor({ id, isCustom: false });
    assert.ok(technique, `exercise ${id} has no technique`);
  }
});

test('all motions render valid SVG without NaN and stay inside the scene', () => {
  for (const key of Object.keys(MOTIONS)) {
    for (const phase of [0, 0.13, 0.25, 0.5, 0.77, 0.99]) {
      const svg = renderFigureSvg(key, phase);
      assert.ok(svg.startsWith('<svg'), key);
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${key}@${phase} contains NaN/undefined`);
      const s = buildSkeleton(MOTIONS[key], phase);
      for (const [name, [x, y]] of Object.entries(s)) {
        assert.ok(x > -5 && x < VIEW.W + 5, `${key}@${phase}: ${name}.x=${x.toFixed(1)} outside`);
        assert.ok(y > -5 && y < VIEW.H, `${key}@${phase}: ${name}.y=${y.toFixed(1)} outside`);
      }
    }
  }
});

test('feet stay on the ground for ground-anchored motions', () => {
  for (const [key, m] of Object.entries(MOTIONS)) {
    if (m.anchor !== 'ground' || m.frames.some((f) => f.at)) continue;
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      const s = buildSkeleton(m, phase);
      const lowest = Math.max(s.ankleN[1], s.ankleF[1], s.toeN[1], s.toeF[1]);
      assert.ok(Math.abs(lowest - (VIEW.GROUND - 3)) < 0.5, `${key}@${phase}: feet at ${lowest}`);
    }
  }
});

test('custom exercises are recognised by name', () => {
  const cases = {
    'Sled Push': null, 'Kettlebell Goblet Squat': 'gobletSquat', 'Bulgarian split squat': 'lunge',
    'Incline Smith Press': 'inclineBench', 'Kreuzheben': 'deadlift', '40m Sprint': 'sprint',
    'Hammer Curls': 'curl', 'Seated Cable Row': 'cableRow', 'Hollow Hold Plank': 'hollow',
    'Copenhagen Plank': 'copenhagen', 'KB Swing': 'kbSwing', 'Hang Clean': 'clean', 'Pallof Press (Band)': 'pallof',
  'Australian Pull-up': 'invertedRow', 'Box Step-Up': 'stepUp', 'Cossack Squat': 'lateralLunge', 'Skater Jumps': 'lateralBound',
  'Easy Jog': 'jog', 'Single-Leg RDL (DB)': 'slRdl', 'Dead Bug': 'deadBug', 'Air Squat': 'airSquat',
};
  for (const [name, expected] of Object.entries(cases)) {
    assert.equal(motionFor({ id: 1000, name, isCustom: true, trackingType: 'WeightReps' as const }), expected, name);
  }
  assert.equal(motionFor({ id: 1001, name: 'Sled Sprint Drag', isCustom: true, trackingType: 'DistanceTime' as const }), 'sprint');
});
