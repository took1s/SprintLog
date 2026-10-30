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

async function newPage({ locale = 'en-US' } = {}) {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, locale });
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

const PASSWORD = 'secret-password';

/** Registrierung über die UI. Liefert einen Bearer-Token für direkte API-Prüfungen und die Wiederherstellungscodes. */
async function registerWithCodes(page, username) {
  await page.goto(BASE);
  await page.click('[data-test=to-register]');
  await page.fill('#auth-user', username);
  await page.fill('#auth-pass', PASSWORD);
  await page.click('button[type=submit]');
  // Wiederherstellungscodes werden genau einmal gezeigt und müssen bestätigt werden.
  await page.waitForSelector('[data-test=recovery-codes] li');
  const codes = await page.$$eval('[data-test=recovery-codes] li', (items) => items.map((li) => li.textContent.trim()));
  await page.check('text=I saved the codes somewhere safe');
  await page.click('button:has-text("Continue")');
  await page.waitForSelector('h3:has-text("Bench Press")');
  // Die Browser-Sitzung liegt in httpOnly-Cookies - JavaScript sieht keinen Token.
  assert.equal(await page.evaluate(() => localStorage.getItem('sprintlog_jwt')), null);
  assert.equal(await page.evaluate(() => document.cookie), '', 'session cookies are httpOnly');
  const { token } = await api('POST', '/api/auth/login', null, { username, password: PASSWORD });
  return { token, codes };
}

async function register(page, username) {
  return (await registerWithCodes(page, username)).token;
}

async function logoutViaSettings(page) {
  await page.click('button[aria-label=Settings]');
  await page.click('button:text-is("Log out")');
  await page.waitForSelector('#auth-user');
}

/** Finish -> Abschluss-Dialog -> speichern. */
async function finishWorkout(page) {
  await page.click('button:text-is("Finish")');
  await page.click('button:has-text("Save workout")');
}

/** Übung über die Auswahl in die laufende Einheit holen (Katalog ist dann ausgeblendet). */
async function addViaPicker(page, exercise, query = exercise) {
  await page.click('[data-test=add-exercise]');
  await page.fill('[data-test=picker-search]', query);
  await page.click(`[role=option]:has-text("${exercise}")`);
  await page.click('[data-test=picker-add]');
  await page.waitForSelector(`[data-block] h3:text-is("${exercise}")`);
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
  await page.waitForSelector('[data-test=workout]'); // ab dem ersten Satz: Einheit als Blöcke
  await page.click('nav >> text=FIELD');
  await addViaPicker(page, 'Running / Sprints', 'sprint');
  await page.click('[data-block] h3:text-is("Running / Sprints")');
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

  await page.fill('input[type=search]', 'Tire Flip');
  await page.click('text=Create "Tire Flip"');
  await page.click('button:has-text("Distance + Time")');
  await page.click('button:has-text("Create & log")');
  await page.waitForSelector('text=Distance (m)');
  await page.click('button:has-text("Log set")');
  await finishWorkout(page);
  await page.waitForSelector('article:has-text("Tire Flip")');

  const exercises = await api('GET', '/api/exercises', token);
  const sled = exercises.find((e) => e.name === 'Tire Flip');
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
  await page.waitForSelector('text=Editing workout'); // Bearbeiten direkt in den Übungs-Blöcken
  await page.click('[data-block] button[aria-label^="Edit set"] >> nth=1');
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
  await page.click('[data-block] button[aria-label^="Edit set"]');
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
  await page.click('[data-block] h3:text-is("Barbell Squat")');
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

test('periodized template: week-1 prescription and notes, set note and RIR are saved', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `prev_${Date.now()}`);

  // RIR statt RPE
  await page.click('button[aria-label=Settings]');
  await page.click('text=Effort as RIR (reps in reserve) instead of RPE');
  await page.click('button[aria-label="Close"]');

  await page.click('nav >> text=PLAN');
  await page.click('button[role=radio]:text-is("Field & prevention")');
  await page.waitForSelector('[data-template=fifa-11-plus]');
  assert.equal(await page.locator('[data-template=gzclp]').count(), 0, 'gym templates are filtered out');
  await page.click('[data-template=hamstring-groin-shield] >> button:text-is("Start")');
  await page.waitForSelector('text=Active program');
  await page.click('button:has-text("Start Prevention")');

  // Woche 1 des Nordic-Protokolls: 2 × 5, mit Hinweis
  await page.waitForSelector('text=Partner holds the heels, fall as slowly as possible');
  await page.waitForSelector('text=2 × 5');
  await page.click('[data-block] h3:text-is("Nordic Hamstring Curls")');
  await page.waitForSelector('text=reps in reserve');
  await page.click('button[data-rpe="8"]');
  assert.equal((await page.textContent('button[data-rpe="8"]')).trim(), '2', 'RPE 8 is shown as RIR 2');
  await page.click('text=+ Note');
  await page.fill('#in-set-note', 'Felt it in the left hamstring');
  await page.click('button:has-text("Log set")');
  await page.click('button[aria-label="Stop timer"]');

  await finishWorkout(page);
  await page.waitForSelector('[data-test=set-note]:text-is("Felt it in the left hamstring")');
  await page.waitForSelector('text=RIR 2');
  const [workout] = await api('GET', '/api/workouts/history', token);
  assert.equal(workout.sets[0].note, 'Felt it in the left hamstring');
  assert.equal(workout.sets[0].rpe, 8);
  assert.deepEqual(errors, []);
  await context.close();
});

test('match without sets is saved, edited and counted; daily check-in is stored', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `match_${Date.now()}`);

  await page.click('nav >> text=FIELD');
  await page.click('[data-test=log-match]');
  await page.fill('#match-minutes', '80');
  await page.click('[data-match-rpe="8"]');
  await page.waitForSelector('text=training load 640 AU');
  await page.fill('#match-opponent', 'TSV Pfuhl');
  await page.fill('input[placeholder="0"] >> nth=0', '1');
  await page.click('button:has-text("Save match")');
  await page.waitForSelector('[data-test=match-summary] >> text=vs TSV Pfuhl');
  await page.waitForSelector('text=1 G · 0 A');

  let history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.deepEqual([history[0].workoutType, history[0].durationSeconds, history[0].sessionRpe, history[0].sets.length, history[0].match.goals], ['Match', 4800, 8, 0, 1]);

  // Bearbeiten öffnet wieder den Spiel-Dialog
  await page.click('article >> button:text-is("Edit")');
  await page.fill('#match-minutes', '90');
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector('text=Workout updated.');
  await page.waitForTimeout(400);
  history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1, 'edit does not create a second match');
  assert.equal(history[0].durationSeconds, 5400);

  // Check-in
  await page.click('nav >> text=PLAN');
  await page.click('[data-test=check-in]');
  for (const [field, value] of [['sleep', 4], ['energy', 5], ['soreness', 3], ['mood', 4]]) await page.click(`[data-wellness="${field}-${value}"]`);
  await page.click('button:has-text("Save check-in")');
  await page.waitForSelector('[data-test=readiness]:text-is("75%")');
  await page.waitForTimeout(300);
  const wellness = await api('GET', '/api/wellness', token);
  assert.deepEqual([wellness.length, wellness[0].sleep, wellness[0].energy], [1, 4, 5]);
  assert.deepEqual(errors, []);
  await context.close();
});

test('language: browser language is detected, switching in settings translates the app and persists', async () => {
  // Deutscher Browser -> Anmeldemaske auf Deutsch, ohne etwas einzustellen.
  const german = await newPage({ locale: 'de-DE' });
  await german.page.goto(BASE);
  await german.page.waitForSelector('text=Passwort vergessen?');
  assert.equal(await german.page.evaluate(() => document.documentElement.lang), 'de');
  assert.deepEqual(german.errors, []);
  await german.context.close();

  const { page, errors, context } = await newPage();
  await register(page, `lang_${Date.now()}`);
  await page.click('button[aria-label=Settings]');
  await page.click('button[lang=ru]');
  await page.click('button[aria-label="Закрыть"]');
  await page.waitForSelector('nav >> text=ПЛАН');
  // Standard-Übungen und Vorlagen werden übersetzt.
  await page.waitForSelector('h3:text-is("Жим штанги лёжа")');
  await page.click('nav >> text=ПЛАН');
  await page.waitForSelector('h4:text-is("Сила для футболиста 2x")');
  // Nach dem Neuladen bleibt die Sprache erhalten.
  await page.reload();
  await page.waitForSelector('nav >> text=ДАННЫЕ');
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'ru');
  assert.deepEqual(errors, []);
  await context.close();
});

test('forgot password: recovery code and e-mail reset link, sessions are httpOnly cookies', async () => {
  const { page, errors, context } = await newPage();
  const username = `rec_${Date.now()}`;
  const { codes } = await registerWithCodes(page, username);
  assert.equal(codes.length, 10);

  const cookies = await context.cookies();
  for (const name of ['sl_at', 'sl_rt']) {
    const c = cookies.find((x) => x.name === name);
    assert.ok(c?.httpOnly, `${name} is httpOnly`);
    assert.equal(c.sameSite, 'Strict');
  }

  // 1. Mit Wiederherstellungscode
  await logoutViaSettings(page);
  await page.click('[data-test=forgot]');
  await page.click('text=Use a recovery code instead');
  await page.fill('#auth-user', username);
  await page.fill('#auth-code', codes[0].replace('-', '').toLowerCase());
  await page.fill('#auth-new', 'recovered-password-1');
  await page.click('button:has-text("Set new password")');
  await page.waitForSelector('h3:has-text("Bench Press")');
  assert.equal((await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: PASSWORD }) })).status, 401);

  // 2. E-Mail hinterlegen und bestätigen
  await page.click('button[aria-label=Settings]');
  await page.click('text=E-mail for password reset');
  await page.fill('[data-test=security] input[type=email]', `${username}@example.com`);
  await page.fill('[data-test=security] input[placeholder="Confirm with password"]', 'recovered-password-1');
  await page.click('[data-test=security] button:has-text("Save")');
  await page.waitForSelector('text=We sent a confirmation link');
  const verify = (await api('GET', '/api/__test/outbox')).at(-1);
  await page.goto(verify.link);
  await page.waitForSelector('text=E-mail confirmed');
  assert.ok(!page.url().includes('verify='), 'token removed from the address bar');

  // 3. Passwort per E-Mail-Link zurücksetzen
  await logoutViaSettings(page);
  await page.click('[data-test=forgot]');
  await page.fill('#auth-login', `${username}@example.com`);
  await page.click('button:has-text("Send reset link")');
  await page.waitForSelector('text=a reset link is on its way');
  const reset = (await api('GET', '/api/__test/outbox')).at(-1);
  assert.ok(reset.link.includes('reset='));
  await page.goto(reset.link);
  await page.fill('#auth-new', 'from-email-password-2');
  await page.click('button:has-text("Save new password")');
  await page.waitForSelector('h3:has-text("Bench Press")');
  const login = await api('POST', '/api/auth/login', null, { username, password: 'from-email-password-2' });
  assert.ok(login.token);
  assert.deepEqual(errors, []);
  await context.close();
});

test('older app versions with a token in localStorage are moved to a cookie session', async () => {
  const username = `legacytok_${Date.now()}`;
  const registered = await api('POST', '/api/auth/register', null, { username, password: PASSWORD });
  const { page, errors, context } = await newPage();
  await page.goto(BASE);
  await page.evaluate(([token, user]) => {
    localStorage.setItem('sprintlog_jwt', token);
    localStorage.setItem('sprintlog:user', JSON.stringify(user));
  }, [registered.token, { userId: registered.userId, username }]);
  await page.reload();
  await page.waitForSelector('h3:has-text("Bench Press")');
  await page.waitForFunction(() => !localStorage.getItem('sprintlog_jwt'));
  assert.ok((await context.cookies()).some((c) => c.name === 'sl_rt'), 'refresh cookie issued');
  // Schreiben funktioniert mit der neuen Cookie-Sitzung
  await logSet(page, 'Bench Press');
  await finishWorkout(page);
  await page.waitForSelector('text=Workout saved.');
  assert.equal((await api('GET', '/api/workouts/history', registered.token)).length, 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('flaky gym network: a failed send without any offline event is shown and can be sent with one tap', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `flaky_${Date.now()}`);

  // Der Browser hält sich für online, aber der Request scheitert (Funkloch) - kein 'offline'/'online'-Event.
  await page.route('**/api/workouts', (route) => route.abort('connectionreset'));
  await logSet(page, 'Bench Press');
  await finishWorkout(page);
  await page.waitForSelector('[data-testid=unsent-banner]:has-text("only on this device")');
  // Ehrliche Meldung: nicht "gespeichert", sondern "auf dem Gerät gespeichert, wird synchronisiert".
  await page.waitForSelector('text=Workout saved offline - will sync automatically.');
  if (process.env.SHOT_DIR) { await page.waitForTimeout(3500); await page.screenshot({ path: path.join(process.env.SHOT_DIR, "unsent-banner.png") }); }
  assert.equal((await api('GET', '/api/workouts/history', token)).length, 0);

  await page.unroute('**/api/workouts');
  await page.click('[data-testid=unsent-banner] button:has-text("Send now")');
  await page.waitForSelector('[data-testid=unsent-banner]', { state: 'detached', timeout: 10000 });
  assert.equal((await api('GET', '/api/workouts/history', token)).length, 1, 'synced exactly once');
  assert.deepEqual(errors.filter((e) => !e.includes('ERR_CONNECTION_RESET')), []);
  await context.close();
});

test('one tap per set: add exercises, ghost rows are prefilled, repeat last workout reuses every set', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `tap_${Date.now()}`);

  await page.click('[data-test=start-empty]');
  // Neue Katalog-Übungen (v7) über Slang/Marke findbar
  await page.fill('[data-test=picker-search]', 'пуловер');
  await page.waitForSelector('[role=option]:has-text("Pullover Machine")');
  await page.fill('[data-test=picker-search]', 'hammer strength');
  assert.ok(await page.locator('[role=option]:has-text("Hammer Strength")').count() >= 4, 'Hammer Strength machines');
  // Mehrsprachige Suche: deutscher Begriff findet die englische Übung, Synonym findet Kreuzheben.
  await page.fill('[data-test=picker-search]', 'bankdrücken');
  await page.click('[role=option]:has-text("Bench Press")');
  await page.fill('[data-test=picker-search]', 'kreuzheben');
  await page.click('[role=option]:has-text("Deadlift (Conventional)")');
  await page.click('[data-test=picker-add]:has-text("Add 2 exercises")');

  const bench = page.locator('[data-block="1"]');
  await bench.locator('[data-test=ghost-weight]').fill('80');
  await bench.locator('[data-test=ghost-reps]').fill('5');
  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');
  // Nächster Satz übernimmt die Werte -> ein Tipp
  assert.equal(await bench.locator('[data-test=ghost-weight]').inputValue(), '80');
  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');

  const dead = page.locator('[data-block="63"]');
  await dead.locator('[data-test=ghost-weight]').fill('120');
  await dead.locator('[data-test=ghost-reps]').fill('3');
  await dead.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');

  await page.click('[data-test=finish-workout]');
  await page.click('button:has-text("Save workout")');
  await page.waitForSelector('text=Workout saved.');
  let history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].sets.map((s) => [s.exerciseId, s.weight, s.reps]), [[1, 80, 5], [1, 80, 5], [63, 120, 3]]);

  // Wiederholen: gleiche Übungen, jeder Satz vorausgefüllt, nichts ist schon geloggt
  await page.click('nav >> text=GYM');
  await page.click('[data-test=start-repeat]');
  await page.waitForSelector('[data-block="1"] [data-test=ghost-row]');
  assert.equal(await page.locator('[data-block="1"] [data-test=ghost-weight]').inputValue(), '80');
  assert.equal(await page.locator('[data-block="63"] [data-test=ghost-weight]').inputValue(), '120');
  assert.equal(await page.locator('[data-test=finish-workout]').isDisabled(), true, 'nothing logged yet');
  assert.deepEqual(errors, []);
  await context.close();
});
