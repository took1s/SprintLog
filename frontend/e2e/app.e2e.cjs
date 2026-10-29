// End-to-End-Tests gegen das Mock-Backend (npm run test:e2e).
// Prüft die kritischen Nutzerflüsse im echten Browser - inkl. Offline-Modus über den Service Worker.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
let server;
let browser;

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'dev', 'mock-api.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => d.toString().includes('mock API') && resolve());
    server.on('exit', (code) => reject(new Error(`mock exited ${code}`)));
  });
  // CHROMIUM_PATH: optional vorhandenes Chromium nutzen (sonst das von "npx playwright install").
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function api(method, url, token, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status === 204 ? null : res.json();
}

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective}: ${e.blockedURI}`));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('Failed to load resource') && errors.push(m.text()));
  return { context, page, errors };
}

async function register(page, username) {
  await page.goto(BASE);
  await page.click('form button[type=button]');
  await page.fill('#auth-user', username);
  await page.fill('#auth-pass', 'secret-password');
  await page.click('button[type=submit]');
  await page.waitForSelector('h3:has-text("Bench Press")');
  return page.evaluate(() => localStorage.getItem('sprintlog_jwt'));
}

/** Finish -> Abschluss-Dialog -> speichern. */
async function finishWorkout(page) {
  await page.click('button:text-is("Finish")');
  await page.click('button:has-text("Save workout")');
}

async function logSet(page, exercise) {
  await page.click(`h3:text-is("${exercise}")`);
  await page.waitForSelector('button:has-text("Log set")');
  await page.click('button:has-text("Log set")');
  await page.waitForSelector('button:has-text("Log set")', { state: 'detached' });
}

test('register, log gym + field sets, finish -> stored on server with client date', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `e2e_${Date.now()}`);

  await logSet(page, 'Bench Press');
  await page.click('nav >> text=FIELD');
  await page.click('h3:text-is("Running / Sprints")');
  await page.fill('#in-distance', '40');
  await page.fill('#in-time', '5.1');
  await page.click('button:has-text("Log set")');
  await finishWorkout(page);
  await page.waitForSelector('text=Hybrid');

  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.equal(history[0].workoutType, 'Hybrid');
  assert.deepEqual(history[0].sets.map((s) => s.exerciseName), ['Bench Press', 'Running / Sprints']);
  assert.equal(history[0].sets[1].distance, 40);
  assert.equal(history[0].sets[1].time, 5.1);
  assert.ok(history[0].clientId, 'clientId sent for idempotency');

  // Auswertungen inkl. Chart.js laufen unter der strikten CSP (Verstöße wären Konsolenfehler).
  await page.click('button.subtab:text-is("Overview")');
  await page.waitForSelector('canvas[aria-label="Weekly totals chart"]');
  await page.click('button.subtab:text-is("Progress")');
  await page.waitForSelector('canvas[aria-label="Progress chart"]');
  await page.click('button.subtab:text-is("Calendar")');
  await page.waitForSelector('text=Activity');
  assert.equal(await page.evaluate(() => window.__cspViolations?.length ?? 0), 0, 'no CSP violations');
  assert.deepEqual(errors, []);
  await context.close();
});

test('offline: app loads from service worker, saves workout locally and syncs once online', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `offline_${Date.now()}`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('h3:has-text("Bench Press")');

  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('text=Offline');
  await page.waitForSelector('h3:has-text("Bench Press")'); // Katalog aus dem Cache

  await logSet(page, 'Bench Press');
  await finishWorkout(page);
  await page.waitForSelector('text=Pending sync');
  assert.equal((await api('GET', '/api/workouts/history', token)).length, 0);

  await context.setOffline(false);
  await page.waitForSelector('text=Pending sync', { state: 'detached', timeout: 10000 });
  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1, 'synced exactly once');
  assert.deepEqual(errors, []);
  await context.close();
});

test('legacy v2 offline queue is migrated and synced without duplicates', async () => {
  const { page, context } = await newPage();
  const token = await register(page, `legacy_${Date.now()}`);
  await page.evaluate(() => {
    localStorage.setItem('sync_queue', JSON.stringify([
      { id: Date.now() - 86400000, workoutType: 'Gym', status: 'pending', sets: [{ exerciseId: 1, name: 'Bench Press', weight: 60, reps: 8, distance: 0, time: 0 }] },
    ]));
  });
  await page.reload();
  await page.waitForFunction(() => !localStorage.getItem('sync_queue'));
  await page.waitForTimeout(800);
  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.equal(history[0].sets[0].weight, 60);
  await context.close();
});

test('custom exercise, favorites, delete workout', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `custom_${Date.now()}`);

  await page.fill('input[type=search]', 'Sled Push');
  await page.click('text=Create "Sled Push"');
  await page.click('button:has-text("Distance + Time")');
  await page.click('button:has-text("Create & log")');
  await page.waitForSelector('text=Distance (m)');
  await page.click('button:has-text("Log set")');
  await finishWorkout(page);
  await page.waitForSelector('article:has-text("Sled Push")');

  const exercises = await api('GET', '/api/exercises', token);
  const sled = exercises.find((e) => e.name === 'Sled Push');
  assert.equal(sled.isCustom, true);
  assert.equal(sled.trackingType, 'DistanceTime');

  await page.click('article >> button:has-text("Delete")');
  await page.click('[role=alertdialog] >> button:has-text("Delete")');
  await page.waitForSelector('text=Workout deleted.');
  assert.equal((await api('GET', '/api/workouts/history', token)).length, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('RPE, warm-up, session RPE and notes are saved; editing a workout updates it via PUT', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `edit_${Date.now()}`);

  // Aufwärmsatz + Arbeitssatz mit RPE
  await page.click('h3:text-is("Bench Press")');
  await page.fill('#in-weight', '40');
  await page.check('text=Warm-up');
  await page.click('button:has-text("Log set")');
  await page.click('button[aria-label="Stop timer"]');
  await page.click('h3:text-is("Bench Press")');
  await page.fill('#in-weight', '80');
  await page.click('.preset-btn:text-is("8.5")');
  await page.click('button:has-text("Log set")');

  await page.click('button:has-text("Finish")');
  await page.click('[aria-label="Finish workout"] button:text-is("7")');
  await page.fill('#finish-notes', 'Good session');
  await page.click('button:has-text("Save workout")');
  await page.waitForSelector('text=Good session');

  let [w] = await api('GET', '/api/workouts/history', token);
  assert.equal(w.sessionRpe, 7);
  assert.equal(w.notes, 'Good session');
  assert.equal(w.sets[0].isWarmup, true);
  assert.equal(w.sets[1].rpe, 8.5);

  // Bearbeiten: Gewicht des Arbeitssatzes ändern
  await page.click('article >> button:text-is("Edit")');
  await page.waitForSelector('text=Edit workout');
  await page.click('[aria-label="Session review"] button[aria-label="Edit set"] >> nth=1');
  await page.fill('#in-weight', '82.5');
  await page.click('button:has-text("Update set")');
  await page.click('button:text-is("Save")');
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector('text=Workout updated.');
  await page.waitForTimeout(500);

  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1, 'edit does not create a second workout');
  w = history[0];
  assert.equal(w.sets[1].weight, 82.5);
  assert.equal(w.sessionRpe, 7, 'session RPE kept');
  assert.deepEqual(errors, []);
  await context.close();
});

test('editing offline queues the change and syncs it with PUT once online', async () => {
  const { page, context } = await newPage();
  const token = await register(page, `offedit_${Date.now()}`);
  await logSet(page, 'Bench Press');
  await finishWorkout(page);
  await page.waitForSelector('article:has-text("Bench Press")');
  await page.waitForFunction(() => !document.body.innerText.includes('Pending sync'));

  await context.setOffline(true);
  await page.click('article >> button:text-is("Edit")');
  await page.click('[aria-label="Session review"] button[aria-label="Edit set"]');
  await page.fill('#in-reps', '3');
  await page.click('button:has-text("Update set")');
  await page.click('button:text-is("Save")');
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector('text=Edit pending');
  assert.notEqual((await api('GET', '/api/workouts/history', token))[0].sets[0].reps, 3);

  await context.setOffline(false);
  await page.waitForSelector('text=Edit pending', { state: 'detached', timeout: 10000 });
  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.equal(history[0].sets[0].reps, 3);
  await context.close();
});

test('training program: start template, follow the plan day, next day rotates', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `plan_${Date.now()}`);

  await page.click('nav >> text=PLAN');
  await page.click('div.glass-panel:has(h4:text-is("Full Body Beginner")) >> button:text-is("Start")');
  await page.waitForSelector('text=Active program');
  const [program] = await api('GET', '/api/programs', token);
  assert.equal(program.isActive, true);

  await page.click('button:has-text("Start Full body A")');
  await page.waitForSelector('text=0/12');
  await page.click('button:has(div:text-is("Barbell Squat"))');
  await page.waitForSelector('text=Pick a weight for 10 reps');
  await page.fill('#in-weight', '60');
  await page.click('button:has-text("Log set")');
  await page.click('button[aria-label="Stop timer"]');
  await page.waitForSelector('text=1/12');

  await finishWorkout(page);
  await page.waitForSelector('text=📋 Full Body Beginner · Full body A');
  const [workout] = await api('GET', '/api/workouts/history', token);
  assert.equal(workout.programDayId, program.days[0].id);

  await page.click('nav >> text=PLAN');
  await page.waitForSelector('button:has-text("Start Full body B")');
  assert.deepEqual(errors, []);
  await context.close();
});
