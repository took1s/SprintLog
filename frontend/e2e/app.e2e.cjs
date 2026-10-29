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
  browser = await chromium.launch();
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
  await page.click('button:has-text("Finish")');
  await page.waitForSelector('text=Hybrid');

  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.equal(history[0].workoutType, 'Hybrid');
  assert.deepEqual(history[0].sets.map((s) => s.exerciseName), ['Bench Press', 'Running / Sprints']);
  assert.equal(history[0].sets[1].distance, 40);
  assert.equal(history[0].sets[1].time, 5.1);
  assert.ok(history[0].clientId, 'clientId sent for idempotency');
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
  await page.click('button:has-text("Finish")');
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
  await page.click('button:has-text("Finish")');
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
