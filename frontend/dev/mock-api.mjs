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

// Plan-Vorlagen: dieselbe JSON-Datei wie die API (SprintLog.Api/Data/program-templates.json, eingebettete Ressource).
const PX_DEFAULTS = { repsMin: null, repsMax: null, distance: null, time: null, targetRpe: null, restSeconds: null, progressionStep: null, percentOf1Rm: null, note: null, weekSteps: [] };
const templates = JSON.parse(readFileSync(join(root, 'SprintLog.Api', 'Data', 'program-templates.json'), 'utf8')).map((t) => ({
  sources: [], category: 'Gym', cycleWeeks: null, deloadEvery: null, sessionsPerWeek: null, ...t,
  daysPerWeek: t.sessionsPerWeek ?? t.days.length,
  days: t.days.map((d) => ({ id: null, notes: null, ...d, exercises: d.exercises.map((x) => ({ ...PX_DEFAULTS, ...x })) })),
}));
// Gleiche Content-Security-Policy wie die echte API -> E2E-Tests finden CSP-Verstöße (Konsolenfehler).
const CSP = JSON.parse(readFileSync(join(root, 'SprintLog.Api', 'appsettings.json'), 'utf8')).Security.ContentSecurityPolicy;

const db = { users: [], wellness: [], exercises: [...seed], workouts: [], deleted: [], favorites: [], programs: [], refresh: [], codes: [], links: [], outbox: [], nextExerciseId: 1000, nextWorkoutId: 1, nextUserId: 1, nextProgramId: 1, nextDayId: 1, nextPxId: 1 };

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
    cycleWeeks: input.cycleWeeks ?? null, deloadEvery: input.deloadEvery ?? null,
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

// ---------- Auth wie in der echten API: Cookie-Sitzung für die Browser-App, Bearer-Token für API-Clients ----------
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const makeToken = (u, seconds = 7 * 86400) => `${b64url({ alg: 'none' })}.${b64url({ nameid: String(u.id), unique_name: u.username, ver: u.tokenVersion ?? 0, exp: Math.floor(Date.now() / 1000) + seconds })}.mock`;
const isBrowser = (req) => req.headers['x-requested-with'] === 'SprintLog';
const cookiesOf = (req) => Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, v.join('=')]));
const randomToken = () => randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { const c = Array.from({ length: 10 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join(''); return `${c.slice(0, 5)}-${c.slice(5)}`; };
const normalizeCode = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function userFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    const u = db.users.find((x) => x.id === Number(payload.nameid));
    if (!u || (payload.ver ?? 0) !== (u.tokenVersion ?? 0) || payload.exp * 1000 < Date.now()) return null;
    return u;
  } catch { return null; }
}
function authUser(req) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return userFromToken(header.slice(7));
  const access = cookiesOf(req).sl_at;
  if (!access) return null;
  // CSRF: schreibende Requests mit Cookie nur mit dem App-Header
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !isBrowser(req)) return null;
  return userFromToken(access);
}
function setSessionCookies(res, user, familyId = randomUUID()) {
  const refresh = randomToken();
  db.refresh.push({ token: refresh, userId: user.id, familyId, revokedAt: null, rotated: false });
  res.setHeader('Set-Cookie', [
    `sl_at=${makeToken(user, 15 * 60)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${15 * 60}`,
    `sl_rt=${refresh}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${30 * 86400}`,
  ]);
}
const clearSessionCookies = (res) => res.setHeader('Set-Cookie', ['sl_at=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0', 'sl_rt=; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0']);
function signIn(req, res, status, user, extra = {}) {
  if (isBrowser(req)) { setSessionCookies(res, user); return json(res, status, { token: null, username: user.username, userId: user.id, ...extra }); }
  return json(res, status, { token: makeToken(user), username: user.username, userId: user.id, ...extra });
}
function regenerateCodes(user) {
  db.codes = db.codes.filter((c) => c.userId !== user.id);
  const codes = Array.from({ length: 10 }, newCode);
  codes.forEach((code) => db.codes.push({ userId: user.id, code: normalizeCode(code), usedAt: null }));
  return codes;
}
function setPassword(user, password) {
  user.password = password;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  db.refresh.filter((t) => t.userId === user.id).forEach((t) => { t.revokedAt ??= Date.now(); });
}
function sendMail(to, subject, param, token) {
  const link = `http://localhost:${port}/?${param}=${token}`;
  db.outbox.push({ to, subject, link, sentAt: new Date().toISOString() });
}
const visible = (userId) => db.exercises.filter((e) => e.userId === null || e.userId === userId);
const exerciseDto = (e) => ({ id: e.id, name: e.name, category: e.category, muscleGroup: e.muscleGroup, trackingType: e.trackingType, isCustom: e.userId !== null });

function workoutResponse(w) {
  return {
    id: w.id, clientId: w.clientId, date: w.date, workoutType: w.workoutType, durationSeconds: w.durationSeconds,
    sessionRpe: w.sessionRpe ?? null, quality: w.quality ?? null, notes: w.notes ?? null, programDayId: w.programDayId ?? null, updatedAt: w.updatedAt,
    match: w.workoutType === 'Match' ? { goals: w.match?.goals ?? null, assists: w.match?.assists ?? null, opponent: w.match?.opponent?.trim() || null } : null,
    sets: (w.sets ?? []).map((s, i) => {
      const ex = db.exercises.find((e) => e.id === s.exerciseId);
      return { exerciseId: s.exerciseId, exerciseName: ex?.name ?? '?', trackingType: ex?.trackingType ?? 'WeightReps', muscleGroup: ex?.muscleGroup ?? null, setNumber: i + 1, weight: s.weight ?? null, reps: s.reps ?? null, distance: s.distance ?? null, time: s.time ?? null, rpe: s.rpe ?? null, isWarmup: !!s.isWarmup, note: s.note?.trim() || null };
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
  if (!['Gym', 'Football', 'Hybrid', 'Match'].includes(body.workoutType)) errors.workoutType = ['Invalid workout type.'];
  const isMatch = body.workoutType === 'Match';
  if (!isMatch && (!Array.isArray(body.sets) || body.sets.length === 0)) errors.sets = ['Cannot save an empty workout.'];
  if (isMatch && !(body.durationSeconds > 0)) errors.durationSeconds = ['Enter the minutes played.'];
  if (isMatch && !body.sessionRpe) errors.sessionRpe = ['Rate how hard the match was (1-10).'];
  (body.sets ?? []).forEach((s, i) => {
    if ([s.weight, s.reps, s.distance, s.time].some((v) => v != null && v < 0)) errors[`sets[${i}]`] = ['Metrics cannot be negative.'];
  });
  const ids = visible(user.id).map((e) => e.id);
  const unknown = (body.sets ?? []).map((s) => s.exerciseId).filter((id) => !ids.includes(id));
  if (unknown.length) errors.sets = [`Unknown exercise id(s): ${unknown.join(', ')}.`];
  if (body.sessionRpe != null && (body.sessionRpe < 1 || body.sessionRpe > 10)) errors.sessionRpe = ['Session RPE must be between 1 and 10.'];
  if (body.quality != null && (body.quality < 1 || body.quality > 10)) errors.quality = ['Quality must be between 1 and 10.'];
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
    durationSeconds: body.durationSeconds ?? null, sessionRpe: body.sessionRpe ?? null, quality: body.quality ?? null,
    notes: body.notes?.trim() ? body.notes.trim() : null, programDayId: body.programDayId ?? null, sets: body.sets ?? [], match: body.match ?? null,
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

  const findUser = (name) => db.users.find((x) => x.username.toLowerCase() === String(name ?? '').trim().toLowerCase());
  const tooShort = (pw) => !pw || pw.length < 8;

  if (method === 'POST' && (path === '/api/auth/register' || path === '/api/auth/login')) {
    const { username = '', password = '' } = await readBody(req);
    if (path.endsWith('register')) {
      const errors = {};
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username.trim())) errors.username = ["Username must be 3-32 characters: letters, digits, '_', '.', '-'."];
      if (password.length < 8) errors.password = ['Password must be at least 8 characters.'];
      if (Object.keys(errors).length) return problem(res, 400, 'One or more validation errors occurred.', errors);
      if (findUser(username)) return problem(res, 409, 'Username is already taken.');
      const u = addUser(username.trim(), password);
      return signIn(req, res, 201, u, { recoveryCodes: regenerateCodes(u) });
    }
    const u = findUser(username);
    if (!u || u.password !== password) return problem(res, 401, 'Invalid username or password.');
    return signIn(req, res, 200, u);
  }
  if (method === 'GET' && path === '/api/auth/options') return json(res, 200, { emailEnabled: true });
  if (method === 'POST' && path === '/api/auth/refresh') {
    const rt = cookiesOf(req).sl_rt;
    if (isBrowser(req) && rt) {
      const t = db.refresh.find((x) => x.token === rt);
      if (!t) { clearSessionCookies(res); return problem(res, 401, 'Session expired. Please log in again.'); }
      if (t.revokedAt) {
        if (t.rotated && Date.now() - t.revokedAt < 30_000) return problem(res, 409, 'Session is being refreshed. Retry.');
        db.refresh.filter((x) => x.familyId === t.familyId).forEach((x) => { x.revokedAt ??= Date.now(); });
        clearSessionCookies(res);
        return problem(res, 401, 'Session expired. Please log in again.');
      }
      const u = db.users.find((x) => x.id === t.userId);
      if (!u) return problem(res, 401, 'Session expired. Please log in again.');
      Object.assign(t, { revokedAt: Date.now(), rotated: true });
      setSessionCookies(res, u, t.familyId);
      return json(res, 200, { token: null, username: u.username, userId: u.id });
    }
    if (!user) return problem(res, 401, 'Unauthorized');
    return signIn(req, res, 200, user);
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    const rt = cookiesOf(req).sl_rt;
    const t = db.refresh.find((x) => x.token === rt);
    if (t) db.refresh.filter((x) => x.familyId === t.familyId).forEach((x) => { x.revokedAt ??= Date.now(); });
    clearSessionCookies(res);
    return noContent(res);
  }
  if (method === 'POST' && path === '/api/auth/recover') {
    const { username, code, newPassword } = await readBody(req);
    if (tooShort(newPassword)) return problem(res, 400, 'One or more validation errors occurred.', { newPassword: ['Password must be at least 8 characters.'] });
    const u = findUser(username);
    const entry = u && db.codes.find((c) => c.userId === u.id && c.code === normalizeCode(code) && !c.usedAt);
    if (!entry) return problem(res, 400, 'Username or recovery code is invalid.');
    entry.usedAt = Date.now();
    setPassword(u, newPassword);
    return signIn(req, res, 200, u);
  }
  if (method === 'POST' && path === '/api/auth/forgot-password') {
    const { login = '' } = await readBody(req);
    const l = login.trim().toLowerCase();
    const u = db.users.find((x) => x.emailVerified && (l.includes('@') ? x.email === l : x.username.toLowerCase() === l));
    if (u) {
      const token = randomToken();
      db.links.push({ token, userId: u.id, purpose: 'reset', usedAt: null });
      sendMail(u.email, 'Reset your SprintLog password', 'reset', token);
    }
    return json(res, 202, { message: 'If the account has a confirmed e-mail, a reset link is on its way.' });
  }
  if (method === 'POST' && path === '/api/auth/reset-password') {
    const { token, newPassword } = await readBody(req);
    if (tooShort(newPassword)) return problem(res, 400, 'One or more validation errors occurred.', { newPassword: ['Password must be at least 8 characters.'] });
    const link = db.links.find((x) => x.token === token && x.purpose === 'reset' && !x.usedAt);
    const u = link && db.users.find((x) => x.id === link.userId);
    if (!u) return problem(res, 400, 'This link is invalid or has expired. Request a new one.');
    link.usedAt = Date.now();
    setPassword(u, newPassword);
    return signIn(req, res, 200, u);
  }
  if (method === 'POST' && path === '/api/auth/email/verify') {
    const { token } = await readBody(req);
    const link = db.links.find((x) => x.token === token && x.purpose === 'verify' && !x.usedAt);
    const u = link && db.users.find((x) => x.id === link.userId && x.email === link.email);
    if (!u) return problem(res, 400, 'This link is invalid or has expired.');
    link.usedAt = Date.now();
    u.emailVerified = true;
    return json(res, 200, { email: u.email });
  }
  if (method === 'GET' && path === '/api/__test/outbox') return json(res, 200, db.outbox);

  if (!user) return problem(res, 401, 'Unauthorized');

  if (method === 'GET' && path === '/api/config') return json(res, 200, { sentryDsn: null, environment: 'Mock', release: 'sprintlog@mock' });
  if (method === 'GET' && path === '/api/auth/me') {
    return json(res, 200, {
      id: user.id, username: user.username, createdAt: user.createdAt, workoutCount: db.workouts.filter((w) => w.userId === user.id).length, customExerciseCount: 0,
      email: user.email ?? null, emailVerified: !!user.emailVerified, recoveryCodesRemaining: db.codes.filter((c) => c.userId === user.id && !c.usedAt).length,
    });
  }
  if (method === 'POST' && path === '/api/auth/logout-all') {
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    db.refresh.filter((t) => t.userId === user.id).forEach((t) => { t.revokedAt ??= Date.now(); });
    clearSessionCookies(res);
    return noContent(res);
  }
  if (method === 'POST' && path === '/api/auth/password') {
    const { currentPassword, newPassword } = await readBody(req);
    if (currentPassword !== user.password) return problem(res, 403, 'Current password is incorrect.');
    if (tooShort(newPassword)) return problem(res, 400, 'One or more validation errors occurred.', { newPassword: ['Password must be at least 8 characters.'] });
    setPassword(user, newPassword);
    return signIn(req, res, 200, user);
  }
  if (method === 'POST' && path === '/api/auth/recovery-codes') {
    const { password } = await readBody(req);
    if (password !== user.password) return problem(res, 403, 'Password is incorrect.');
    return json(res, 200, { codes: regenerateCodes(user) });
  }
  if (method === 'PUT' && path === '/api/auth/email') {
    const { email = '', password } = await readBody(req);
    if (password !== user.password) return problem(res, 403, 'Password is incorrect.');
    const e = email.trim().toLowerCase();
    if (!e) { Object.assign(user, { email: null, emailVerified: false }); return noContent(res); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return problem(res, 400, 'One or more validation errors occurred.', { email: ['Enter a valid e-mail address.'] });
    if (db.users.some((x) => x.email === e && x.id !== user.id)) return problem(res, 409, 'This e-mail is already used by another account.');
    Object.assign(user, { email: e, emailVerified: false });
    const token = randomToken();
    db.links.push({ token, userId: user.id, purpose: 'verify', email: e, usedAt: null });
    sendMail(e, 'Confirm your e-mail for SprintLog', 'verify', token);
    return json(res, 202, { message: 'Check your inbox to confirm the address.' });
  }
  if (method === 'DELETE' && path === '/api/auth/account') {
    const { password } = await readBody(req);
    if (password !== user.password) return problem(res, 403, 'Password is incorrect.');
    db.workouts = db.workouts.filter((w) => w.userId !== user.id);
    db.favorites = db.favorites.filter((f) => f.userId !== user.id);
    db.exercises = db.exercises.filter((e) => e.userId !== user.id);
    db.users = db.users.filter((u) => u.id !== user.id);
    db.refresh = db.refresh.filter((t) => t.userId !== user.id);
    db.codes = db.codes.filter((c) => c.userId !== user.id);
    clearSessionCookies(res);
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

  // ---- Wellness (pro Tag)
  if (method === 'GET' && path === '/api/wellness') {
    return json(res, 200, db.wellness.filter((w) => w.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)).map(({ userId, ...rest }) => rest));
  }
  m = path.match(/^\/api\/wellness\/(\d{4}-\d{2}-\d{2})$/);
  if (m && method === 'PUT') {
    const body = await readBody(req);
    const bad = ['sleep', 'energy', 'soreness', 'mood'].filter((k) => !(body[k] >= 1 && body[k] <= 5));
    if (bad.length) return problem(res, 400, 'One or more validation errors occurred.', Object.fromEntries(bad.map((k) => [k, ['Values must be between 1 and 5.']])));
    const entry = { userId: user.id, date: m[1], sleep: body.sleep, energy: body.energy, soreness: body.soreness, mood: body.mood, sleepHours: body.sleepHours ?? null, note: body.note?.trim() || null, updatedAt: new Date().toISOString() };
    db.wellness = [...db.wellness.filter((w) => !(w.userId === user.id && w.date === m[1])), entry];
    const { userId, ...rest } = entry;
    return json(res, 200, rest);
  }
  if (m && method === 'DELETE') {
    const before = db.wellness.length;
    db.wellness = db.wellness.filter((w) => !(w.userId === user.id && w.date === m[1]));
    return before === db.wellness.length ? problem(res, 404, 'Not Found') : noContent(res);
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
      durationSeconds: body.durationSeconds ?? null, sessionRpe: body.sessionRpe ?? null, quality: body.quality ?? null,
      notes: body.notes?.trim() ? body.notes.trim() : null, programDayId: body.programDayId ?? null, sets: body.sets ?? [], match: body.match ?? null,
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
      Object.assign(p, { name: body.name, goal: body.goal, weeks: body.weeks, cycleWeeks: body.cycleWeeks ?? null, deloadEvery: body.deloadEvery ?? null });
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
      saveWorkout(user, { workoutType: session.type, clientId: randomUUID(), date: date.toISOString(), durationSeconds: 3600 + i * 300, sessionRpe: 5 + ((week + i) % 4), quality: 5 + ((week * 3 + i) % 5), sets });
      day++;
    }
  }
  // Spiele am Wochenende und tägliche Check-ins (für Screenshots/Demo)
  const opponents = ['FC Neu-Ulm', 'TSV Pfuhl', 'SC Vöhringen', 'FV Senden', 'TSG Söflingen', 'SV Thalfingen', 'VfL Ulm', 'TV Wiblingen', 'SpVgg Au', 'FC Burlafingen'];
  for (let week = 0; week < 10; week++) {
    const date = new Date(Date.now() - (week * 7 + 2) * 86400_000);
    date.setHours(15, 0, 0, 0);
    saveWorkout(user, { workoutType: 'Match', clientId: randomUUID(), date: date.toISOString(), durationSeconds: (70 + (week * 7) % 21) * 60, sessionRpe: 7 + (week % 3), sets: [], match: { goals: week % 4 === 0 ? 1 : 0, assists: week % 3 === 0 ? 1 : 0, opponent: opponents[week] } });
  }
  for (let d = 0; d < 13; d++) {
    const day = new Date(Date.now() - (d + 1) * 86400_000);
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const v = (o) => 2 + ((d * 7 + o) % 4);
    db.wellness.push({ userId: user.id, date: key, sleep: v(1), energy: v(2), soreness: v(3), mood: v(0), sleepHours: 6 + (d % 3), note: null, updatedAt: day.toISOString() });
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
