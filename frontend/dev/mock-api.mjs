// Mock-Backend für Frontend-Entwicklung und E2E-Tests - ohne .NET und ohne Datenbank.
// Bildet die echte API (Endpunkte, Statuscodes, ProblemDetails, Idempotenz) im Speicher nach.
//
//   npm run mock            -> http://localhost:5111 (leer)
//   npm run mock -- --demo  -> mit Demo-Nutzer "demo" / "demo-password" und 10 Wochen Trainingsdaten
//
// Der Übungskatalog wird direkt aus SprintLog.Api/Data/AppDbContext.cs gelesen (eine Quelle der Wahrheit).

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const wwwroot = join(root, 'SprintLog.Api', 'wwwroot');
const port = Number(process.env.PORT ?? 5111);
const demo = process.argv.includes('--demo');

// ---------- Seed aus dem C#-Code ----------
const seedSource = readFileSync(join(root, 'SprintLog.Api', 'Data', 'AppDbContext.cs'), 'utf8');
const seed = [...seedSource.matchAll(/Ex\((\d+), "([^"]+)", "([^"]+)", "([^"]+)"(?:, TrackingType\.(\w+))?\)/g)]
  .map(([, id, name, category, muscleGroup, trackingType]) => ({ id: Number(id), name, category, muscleGroup, trackingType: trackingType ?? 'WeightReps', userId: null }));

// Plan-Vorlagen aus SprintLog.Api/Services/ProgramTemplates.cs (W = Kraft, Run = Strecke, Hold = Dauer)
const templateSource = readFileSync(join(root, 'SprintLog.Api', 'Services', 'ProgramTemplates.cs'), 'utf8');
// Gleiche Content-Security-Policy wie die echte API -> E2E-Tests finden CSP-Verstöße (Konsolenfehler).
const CSP = JSON.parse(readFileSync(join(root, 'SprintLog.Api', 'appsettings.json'), 'utf8')).Security.ContentSecurityPolicy;
function parseItem(kind, args) {
  const named = Object.fromEntries([...args.matchAll(/(\w+):\s*([\d.]+)/g)].map(([, k, v]) => [k, Number(v)]));
  const nums = args.replace(/\w+:\s*[\d.]+/g, '').split(',').map((x) => x.trim()).filter(Boolean).map(Number);
  if (kind === 'W') {
    const [exerciseId, sets, repsMin, repsMax, restSeconds, targetRpe, step] = nums;
    return { exerciseId, sets, repsMin, repsMax, restSeconds, targetRpe: named.rpe ?? targetRpe ?? null, progressionStep: named.step ?? step ?? 2.5, distance: null, time: null };
  }
  const [exerciseId, sets, value, restSeconds] = nums;
  return { exerciseId, sets, restSeconds, distance: kind === 'Run' ? value : null, time: kind === 'Hold' ? value : null, repsMin: null, repsMax: null, targetRpe: null, progressionStep: null };
}
const templates = [...templateSource.matchAll(/new\("([\w-]+)", "([^"]+)",\s*"([^"]+)",\s*"(\w+)", "([^"]+)", (\d+), new\(\)\s*\{([\s\S]*?)\n\s*\}\),/g)]
  .map(([, key, name, description, goal, level, weeks, body]) => ({
    key, name, description, goal, level, weeks: Number(weeks),
    days: [...body.matchAll(/Day\("([^"]+)", (null|"[^"]*"),([\s\S]*?)\)(?=,\s*\n\s*Day\(|,\s*$|\s*$)/g)].map(([, dayName, notes, items]) => ({
      id: null, name: dayName, notes: notes === 'null' ? null : notes.slice(1, -1),
      exercises: [...items.matchAll(/\b(W|Run|Hold)\(([^)]*)\)/g)].map(([, kind, args]) => parseItem(kind, args)),
    })),
  }));

const db = { users: [], exercises: [...seed], workouts: [], deleted: [], favorites: [], programs: [], nextExerciseId: 1000, nextWorkoutId: 1, nextUserId: 1, nextProgramId: 1, nextDayId: 1, nextPxId: 1 };

function programResponse(p) {
  return {
    ...p,
    days: p.days.map((d, i) => ({
      ...d, position: i,
      exercises: d.exercises.map((x, j) => {
        const ex = db.exercises.find((e) => e.id === x.exerciseId);
        return { ...x, position: j, exerciseName: ex?.name ?? '?', trackingType: ex?.trackingType ?? 'WeightReps', muscleGroup: ex?.muscleGroup ?? null };
      }),
    })),
  };
}
function newProgram(user, input, templateKey, activate) {
  if (activate) db.programs.filter((p) => p.userId === user.id).forEach((p) => { p.isActive = false; });
  const p = {
    id: db.nextProgramId++, userId: user.id, name: input.name, goal: input.goal, weeks: input.weeks, templateKey,
    isActive: activate, startedAt: activate ? new Date().toISOString() : null, createdAt: new Date().toISOString(),
    days: input.days.map((d) => ({ id: db.nextDayId++, name: d.name, notes: d.notes ?? null, exercises: d.exercises.map((x) => ({ ...x, id: db.nextPxId++ })) })),
  };
  db.programs.push(p);
  return p;
}

// ---------- Helfer ----------
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const problem = (res, status, title, errors) => json(res, status, errors ? { title, status, errors } : { title, status });
const noContent = (res) => { res.writeHead(204); res.end(); };

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const makeToken = (u) => `${b64url({ alg: 'none' })}.${b64url({ nameid: String(u.id), unique_name: u.username, exp: Math.floor(Date.now() / 1000) + 7 * 86400 })}.mock`;
function authUser(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(header.slice(7).split('.')[1], 'base64url').toString());
    return db.users.find((u) => u.id === Number(payload.nameid)) ?? null;
  } catch { return null; }
}
const visible = (userId) => db.exercises.filter((e) => e.userId === null || e.userId === userId);
const exerciseDto = (e) => ({ id: e.id, name: e.name, category: e.category, muscleGroup: e.muscleGroup, trackingType: e.trackingType, isCustom: e.userId !== null });

function workoutResponse(w) {
  return {
    id: w.id, clientId: w.clientId, date: w.date, workoutType: w.workoutType, durationSeconds: w.durationSeconds,
    sessionRpe: w.sessionRpe ?? null, notes: w.notes ?? null, programDayId: w.programDayId ?? null, updatedAt: w.updatedAt,
    sets: w.sets.map((s, i) => {
      const ex = db.exercises.find((e) => e.id === s.exerciseId);
      return { exerciseId: s.exerciseId, exerciseName: ex?.name ?? '?', trackingType: ex?.trackingType ?? 'WeightReps', muscleGroup: ex?.muscleGroup ?? null, setNumber: i + 1, weight: s.weight ?? null, reps: s.reps ?? null, distance: s.distance ?? null, time: s.time ?? null, rpe: s.rpe ?? null, isWarmup: !!s.isWarmup };
    }),
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

function addUser(username, password) {
  const user = { id: db.nextUserId++, username, password, createdAt: new Date().toISOString() };
  db.users.push(user);
  return user;
}

function validateWorkout(user, body) {
  const errors = {};
  if (!['Gym', 'Football', 'Hybrid'].includes(body.workoutType)) errors.workoutType = ['Invalid workout type.'];
  if (!Array.isArray(body.sets) || body.sets.length === 0) errors.sets = ['Cannot save an empty workout.'];
  (body.sets ?? []).forEach((s, i) => {
    if ([s.weight, s.reps, s.distance, s.time].some((v) => v != null && v < 0)) errors[`sets[${i}]`] = ['Metrics cannot be negative.'];
  });
  const ids = visible(user.id).map((e) => e.id);
  const unknown = (body.sets ?? []).map((s) => s.exerciseId).filter((id) => !ids.includes(id));
  if (unknown.length) errors.sets = [`Unknown exercise id(s): ${unknown.join(', ')}.`];
  if (body.sessionRpe != null && (body.sessionRpe < 1 || body.sessionRpe > 10)) errors.sessionRpe = ['Session RPE must be between 1 and 10.'];
  return Object.keys(errors).length ? errors : null;
}

function saveWorkout(user, body) {
  const errors = validateWorkout(user, body);
  if (errors) return { status: 400, errors };

  const clientId = body.clientId ?? body.ClientId ?? null;
  const existing = clientId && db.workouts.find((w) => w.userId === user.id && w.clientId === clientId);
  if (existing) return { status: 200, body: { workoutId: existing.id, duplicate: true, message: 'Workout already saved.' } };

  const w = {
    id: db.nextWorkoutId++, userId: user.id, clientId, workoutType: body.workoutType,
    date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
    durationSeconds: body.durationSeconds ?? null, sessionRpe: body.sessionRpe ?? null,
    notes: body.notes?.trim() ? body.notes.trim() : null, programDayId: body.programDayId ?? null, sets: body.sets,
    updatedAt: new Date().toISOString(),
  };
  db.workouts.push(w);
  return { status: 201, body: { workoutId: w.id, duplicate: false, message: 'Workout saved.' } };
}

// ---------- Routing ----------
async function handleApi(req, res, url) {
  const path = url.pathname.replace(/\/$/, '');
  const method = req.method;
  const user = authUser(req);

  if (method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/login')) {
    const { username = '', password = '' } = await readBody(req);
    if (path.endsWith('register')) {
      const errors = {};
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username.trim())) errors.username = ["Username must be 3-32 characters: letters, digits, '_', '.', '-'."];
      if (password.length < 8) errors.password = ['Password must be at least 8 characters.'];
      if (Object.keys(errors).length) return problem(res, 400, 'One or more validation errors occurred.', errors);
      if (db.users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) return problem(res, 409, 'Username is already taken.');
      const u = addUser(username.trim(), password);
      return json(res, 201, { token: makeToken(u), username: u.username, userId: u.id });
    }
    const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || u.password !== password) return problem(res, 401, 'Invalid username or password.');
    return json(res, 200, { token: makeToken(u), username: u.username, userId: u.id });
  }

  if (!user) return problem(res, 401, 'Unauthorized');

  if (method === 'POST' && path === '/api/auth/refresh') return json(res, 200, { token: makeToken(user), username: user.username, userId: user.id });
  if (method === 'GET' && path === '/api/auth/me') {
    return json(res, 200, { id: user.id, username: user.username, createdAt: user.createdAt, workoutCount: db.workouts.filter((w) => w.userId === user.id).length, customExerciseCount: 0 });
  }
  if (method === 'DELETE' && path === '/api/auth/account') {
    const { password } = await readBody(req);
    if (password !== user.password) return problem(res, 403, 'Password is incorrect.');
    db.workouts = db.workouts.filter((w) => w.userId !== user.id);
    db.favorites = db.favorites.filter((f) => f.userId !== user.id);
    db.exercises = db.exercises.filter((e) => e.userId !== user.id);
    db.users = db.users.filter((u) => u.id !== user.id);
    return noContent(res);
  }

  if (method === 'GET' && path === '/api/exercises') return json(res, 200, visible(user.id).sort((a, b) => a.name.localeCompare(b.name)).map(exerciseDto));
  if (method === 'POST' && path === '/api/exercises') {
    const body = await readBody(req);
    const name = (body.name ?? '').trim();
    const errors = {};
    if (name.length < 2 || name.length > 60) errors.name = ['Name must be 2-60 characters.'];
    if (!['Gym', 'Football'].includes(body.category)) errors.category = ["Category must be 'Gym' or 'Football'."];
    if (Object.keys(errors).length) return problem(res, 400, 'One or more validation errors occurred.', errors);
    if (visible(user.id).some((e) => e.name.toLowerCase() === name.toLowerCase())) return problem(res, 409, `An exercise named '${name}' already exists.`);
    const ex = { id: db.nextExerciseId++, name, category: body.category, muscleGroup: body.muscleGroup || 'Other', trackingType: body.trackingType ?? 'WeightReps', userId: user.id };
    db.exercises.push(ex);
    return json(res, 201, exerciseDto(ex));
  }
  let m = path.match(/^\/api\/exercises\/(\d+)$/);
  if (method === 'DELETE' && m) {
    const id = Number(m[1]);
    const ex = db.exercises.find((e) => e.id === id && e.userId === user.id);
    if (!ex) return problem(res, 404, 'Not Found');
    if (db.workouts.some((w) => w.sets.some((s) => s.exerciseId === id))) return problem(res, 409, 'Exercise is used in your history.');
    db.exercises = db.exercises.filter((e) => e !== ex);
    return noContent(res);
  }

  if (method === 'GET' && path === '/api/favorites') return json(res, 200, db.favorites.filter((f) => f.userId === user.id).map((f) => f.exerciseId));
  m = path.match(/^\/api\/favorites\/(\d+)$/);
  if (m && method === 'POST') {
    const id = Number(m[1]);
    if (!visible(user.id).some((e) => e.id === id)) return problem(res, 404, 'Not Found');
    if (!db.favorites.some((f) => f.userId === user.id && f.exerciseId === id)) db.favorites.push({ userId: user.id, exerciseId: id });
    return noContent(res);
  }
  if (m && method === 'DELETE') {
    db.favorites = db.favorites.filter((f) => !(f.userId === user.id && f.exerciseId === Number(m[1])));
    return noContent(res);
  }

  if (method === 'POST' && (path === '/api/workouts' || path === '/api/workouts/save')) {
    const result = saveWorkout(user, await readBody(req));
    return result.errors ? problem(res, 400, 'One or more validation errors occurred.', result.errors) : json(res, result.status, result.body);
  }
  if (method === 'GET' && path === '/api/workouts/history') {
    return json(res, 200, db.workouts.filter((w) => w.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)).map(workoutResponse));
  }
  if (method === 'GET' && path === '/api/workouts/changes') {
    // Vereinfachter Delta-Sync (ohne Seiten): wie die API mit 2 min Überlappung im Token.
    const since = url.searchParams.get('since');
    const own = db.workouts.filter((w) => w.userId === user.id && (!since || w.updatedAt > new Date(since).toISOString()));
    const deletedIds = since ? db.deleted.filter((d) => d.userId === user.id && d.deletedAt > new Date(since).toISOString()).map((d) => d.id) : [];
    return json(res, 200, {
      workouts: own.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id - b.id).map(workoutResponse),
      deletedIds, nextCursor: null, syncToken: new Date(Date.now() - 120_000).toISOString(),
    });
  }
  m = path.match(/^\/api\/workouts\/(\d+)$/);
  if (m && method === 'PUT') {
    const w = db.workouts.find((x) => x.id === Number(m[1]) && x.userId === user.id);
    if (!w) return problem(res, 404, 'Not Found');
    const body = await readBody(req);
    const errors = validateWorkout(user, body);
    if (errors) return problem(res, 400, 'One or more validation errors occurred.', errors);
    Object.assign(w, {
      workoutType: body.workoutType, date: body.date ? new Date(body.date).toISOString() : w.date,
      durationSeconds: body.durationSeconds ?? null, sessionRpe: body.sessionRpe ?? null,
      notes: body.notes?.trim() ? body.notes.trim() : null, programDayId: body.programDayId ?? null, sets: body.sets,
      updatedAt: new Date().toISOString(),
    });
    return json(res, 200, workoutResponse(w));
  }
  if (m && method === 'DELETE') {
    const before = db.workouts.length;
    db.workouts = db.workouts.filter((w) => !(w.id === Number(m[1]) && w.userId === user.id));
    if (db.workouts.length === before) return problem(res, 404, 'Not Found');
    db.deleted.push({ userId: user.id, id: Number(m[1]), deletedAt: new Date().toISOString() });
    return noContent(res);
  }

  // ---- Trainingspläne ----
  if (method === 'GET' && path === '/api/programs/templates') return json(res, 200, templates);
  if (method === 'GET' && path === '/api/programs') {
    return json(res, 200, db.programs.filter((p) => p.userId === user.id).sort((a, b) => b.isActive - a.isActive || b.id - a.id).map(programResponse));
  }
  m = path.match(/^\/api\/programs\/templates\/([\w-]+)$/);
  if (m && method === 'POST') {
    const t = templates.find((x) => x.key === m[1]);
    if (!t) return problem(res, 404, 'Not Found');
    return json(res, 201, programResponse(newProgram(user, t, t.key, true)));
  }
  if (method === 'POST' && path === '/api/programs') {
    const body = await readBody(req);
    if (!body.name || body.name.trim().length < 2) return problem(res, 400, 'One or more validation errors occurred.', { name: ['Name must be 2-60 characters.'] });
    const hasActive = db.programs.some((p) => p.userId === user.id && p.isActive);
    return json(res, 201, programResponse(newProgram(user, { ...body, name: body.name.trim() }, null, !hasActive)));
  }
  m = path.match(/^\/api\/programs\/(\d+)(\/(activate|deactivate))?$/);
  if (m) {
    const p = db.programs.find((x) => x.id === Number(m[1]) && x.userId === user.id);
    if (!p) return problem(res, 404, 'Not Found');
    if (method === 'POST' && m[3] === 'activate') {
      db.programs.filter((x) => x.userId === user.id).forEach((x) => { x.isActive = false; });
      Object.assign(p, { isActive: true, startedAt: new Date().toISOString() });
      return json(res, 200, programResponse(p));
    }
    if (method === 'POST' && m[3] === 'deactivate') { p.isActive = false; return noContent(res); }
    if (method === 'PUT' && !m[3]) {
      const body = await readBody(req);
      Object.assign(p, { name: body.name, goal: body.goal, weeks: body.weeks });
      p.days = body.days.map((d) => ({ id: d.id ?? db.nextDayId++, name: d.name, notes: d.notes ?? null, exercises: d.exercises.map((x) => ({ ...x, id: db.nextPxId++ })) }));
      return json(res, 200, programResponse(p));
    }
    if (method === 'DELETE' && !m[3]) {
      const dayIds = new Set(p.days.map((d) => d.id));
      db.workouts.forEach((w) => { if (dayIds.has(w.programDayId)) Object.assign(w, { programDayId: null, updatedAt: new Date().toISOString() }); });
      db.programs = db.programs.filter((x) => x !== p);
      return noContent(res);
    }
  }

  return problem(res, 404, 'Not Found');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };

function serveStatic(res, url) {
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path === '/' || path === '\\') path = '/index.html';
  const file = join(wwwroot, path);
  if (!file.startsWith(wwwroot) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP });
  res.end(readFileSync(file));
}

// ---------- Demo-Daten ----------
function seedDemo() {
  const user = addUser('demo', 'demo-password');
  user.createdAt = new Date(Date.now() - 80 * 86400_000).toISOString();
  const plan = [
    { type: 'Gym', sets: [[1, 70, 8], [1, 72.5, 8], [1, 75, 6], [44, 55, 10], [44, 55, 10], [69, 10, 12], [9, 30, 10]] },
    { type: 'Football', sets: [['s', 12, 30, 4.6], ['s', 12, 30, 4.5], ['s', 12, 30, 4.4], ['s', 58, 20, 3.6], ['s', 58, 20, 3.5], ['d', 47, 60]] },
    { type: 'Gym', sets: [[35, 80, 6], [35, 85, 5], [35, 85, 5], [49, 70, 8], [33, 20, 10], [4, 60, 12]] },
    { type: 'Hybrid', sets: [[29, 100, 5], [29, 110, 4], ['s', 34, 2.4, 0], ['s', 34, 2.5, 0], ['s', 12, 40, 5.6]] },
  ];
  const now = new Date();
  let day = 0;
  for (let week = 10; week >= 0; week--) {
    for (const [i, session] of plan.entries()) {
      if (week === 0 && i > 1) break;
      if ((week + i) % 5 === 3) continue; // ein paar Lücken
      const date = new Date(now);
      date.setDate(date.getDate() - week * 7 - (6 - i * 2));
      date.setHours(17 + (i % 2), 30, 0, 0);
      if (date > now) continue;
      const progress = (10 - week) * 0.025; // langsame Steigerung
      const sets = session.sets.map((s) => {
        if (s[0] === 's') return { exerciseId: s[1], distance: s[2], time: s[3] ? +(s[3] * (1 - progress / 3)).toFixed(2) : null };
        if (s[0] === 'd') return { exerciseId: s[1], time: Math.round(s[2] * (1 + progress)) };
        return { exerciseId: s[0], weight: Math.round((s[1] * (1 + progress)) / 2.5) * 2.5, reps: s[2] };
      });
      saveWorkout(user, { workoutType: session.type, clientId: randomUUID(), date: date.toISOString(), durationSeconds: 3600 + i * 300, sessionRpe: 5 + ((week + i) % 4), sets });
      day++;
    }
  }
  db.favorites.push({ userId: user.id, exerciseId: 1 }, { userId: user.id, exerciseId: 35 }, { userId: user.id, exerciseId: 12 });
  console.log(`demo: user "demo" / "demo-password" with ${db.workouts.length} workouts`);
}
if (demo) seedDemo();

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/health') return json(res, 200, 'Healthy');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(res, url);
  } catch (e) {
    console.error(e);
    return problem(res, 500, 'Internal Server Error');
  }
}).listen(port, () => console.log(`SprintLog mock API on http://localhost:${port} (${seed.length} seed exercises, ${templates.length} program templates)`));
