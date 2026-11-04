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
  await saveWorkout(page);
}

/** "Save workout" -> Zusammenfassung (Erholung, nächstes Training) erscheint und wird geschlossen. */
async function saveWorkout(page) {
  await page.click('button:has-text("Save workout")');
  await page.click('[data-test=summary-done]');
  await page.waitForSelector('[data-test=workout-summary]', { state: 'detached' });
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
  await saveWorkout(page);
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
  await saveWorkout(page);
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

test('obsidian export: quality is saved, lines match the vault format and are copied', async () => {
  const { page, errors, context } = await newPage();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const token = await register(page, `obs_${Date.now()}`);

  await page.click('[data-test=start-empty]');
  await page.fill('[data-test=picker-search]', 'bench press');
  await page.click('[role=option]:has-text("Bench Press") >> nth=0');
  await page.click('[data-test=picker-add]');
  const bench = page.locator('[data-block="1"]');
  await bench.locator('[data-test=ghost-weight]').fill('80');
  await bench.locator('[data-test=ghost-reps]').fill('5');
  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');
  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');

  await page.click('[data-test=finish-workout]');
  await page.click('[aria-label="Finish workout"] button:text-is("8")');
  await page.click('[data-quality="7"]');
  await page.fill('[aria-label="Finish workout"] input[type=number]', '60');
  await saveWorkout(page);
  await page.waitForSelector('text=Quality 7/10');
  const [w] = await api('GET', '/api/workouts/history', token);
  assert.equal(w.quality, 7);

  await page.click('[data-test=obsidian-open]');
  const text = await page.inputValue('[data-test=obsidian-text]');
  assert.equal(text, '- [ses:: gym] [min:: 60] [rpe:: 8] [qual:: 7] [part:: push]\n- [lift:: Bench Press] [kg:: 80] [reps:: 5] [sets:: 2] [rir:: ]');
  await page.click('[data-test=obsidian-copy]');
  await page.waitForSelector('text=Copied');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), text);
  assert.deepEqual(errors, []);
  await context.close();
});

test('workout UX: exercise info in picker, RPE right after the set, swipe delete + undo, done, action sheet', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `ux_${Date.now()}`);

  await page.click('[data-test=start-empty]');
  // Info-Seite aus dem Picker: Technik + "Auswählen"
  await page.fill('[data-test=picker-search]', 'bench press');
  await page.click('[data-info="1"]');
  await page.waitForSelector('[data-test=exercise-info] >> text=Your numbers');
  await page.click('[data-test=info-pick]');
  await page.waitForSelector('[data-test=exercise-info]', { state: 'detached' });
  await page.fill('[data-test=picker-search]', 'kreuzheben');
  await page.click('[role=option]:has-text("Deadlift (Conventional)")');
  await page.fill('[data-test=picker-search]', 'barbell squat');
  await page.click('[role=option]:has-text("Barbell Squat")');
  await page.click('[data-test=picker-add]:has-text("Add 3 exercises")');

  const bench = page.locator('[data-block="1"]');
  await bench.locator('[data-test=ghost-weight]').fill('80');
  await bench.locator('[data-test=ghost-reps]').fill('5');
  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');
  // RPE direkt unter dem Satz - ein Tipp, kein Dialog
  await bench.locator('[data-test=rpe-strip] [data-rpe="8"]').click();
  await bench.locator('[data-test=rpe-strip]').waitFor({ state: 'detached' });
  await bench.locator('[data-test=set-row]:has-text("@8")').waitFor();

  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');
  assert.equal(await bench.locator('[data-test=set-row]').count(), 2);

  // Nach links wischen = löschen, Rückgängig stellt ihn wieder her
  const row = bench.locator('[data-test=set-row]').nth(1);
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForSelector('text=Set deleted.');
  await bench.locator('[data-test=set-row]').nth(1).waitFor({ state: 'detached' });
  await page.click('[data-test=toast-action]');
  await bench.locator('[data-test=set-row]').nth(1).waitFor();

  // Löschen auch im Bearbeiten-Dialog
  await bench.locator('[data-test=set-row]').nth(1).click();
  await page.click('[data-test=delete-set]');
  await bench.locator('[data-test=set-row]').nth(1).waitFor({ state: 'detached' });

  // Fertig: kein hängender nächster Satz mehr; "+ Set" öffnet wieder
  await bench.locator('[data-test=complete-block]').click();
  await bench.locator('[data-test=ghost-row]').waitFor({ state: 'detached' });
  await bench.locator('[data-test=reopen-block]').click();
  await bench.locator('[data-test=ghost-row]').waitFor();

  // Menü der mittleren Übung liegt über allen Blöcken
  await page.click('[data-block="63"] button[aria-label="Exercise options"]');
  await page.click('[data-test=sheet-remove]');
  await page.waitForSelector('[data-block="63"]', { state: 'detached' });
  assert.equal(await page.locator('[data-block]').count(), 2);

  await page.click('[data-test=finish-workout]');
  await saveWorkout(page);
  const [w] = await api('GET', '/api/workouts/history', token);
  assert.deepEqual(w.sets.map((s) => [s.exerciseId, s.weight, s.reps, s.rpe]), [[1, 80, 5, 8]]);
  assert.deepEqual(errors, []);
  await context.close();
});

test('strength goal: set in the plan tab, synced, next session prefilled from it', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `goal_${Date.now()}`);

  await page.click('nav >> text=PLAN');
  await page.click('[data-test=goal-new]');
  await page.fill('[data-test=goal-search]', 'bench press');
  await page.click('[data-goal-pick="1"]');
  await page.fill('[data-test=goal-weight]', '100');
  await page.fill('[data-test=goal-start]', '90');
  await page.waitForSelector('[data-test=goal-preview] >> text=Start: 3×5 @ 72.5 kg');
  await page.click('[data-test=goal-save]');
  await page.waitForSelector('[data-goal="1"] >> text=100 kg 1RM');
  const goals = await api('GET', '/api/goals', token);
  assert.deepEqual(goals.map((g) => [g.exerciseId, g.targetWeight, g.targetReps, g.startE1RM]), [[1, 100, 1, 90]]);

  // Die Einheit übernimmt die Vorgabe des Ziels
  await page.click('nav >> text=GYM');
  await page.click('[data-test=start-empty]');
  await page.fill('[data-test=picker-search]', 'bench press');
  await page.click('[role=option]:has-text("Bench Press") >> nth=0');
  await page.click('[data-test=picker-add]');
  const bench = page.locator('[data-block="1"]');
  await bench.locator('[data-test=block-goal]').waitFor();
  assert.equal(await bench.locator('[data-test=ghost-weight]').inputValue(), '72.5');
  assert.equal(await bench.locator('[data-test=ghost-reps]').inputValue(), '5');
  assert.deepEqual(errors, []);
  await context.close();
});

test('hamstring rehab: phase 1 template starts with Askling Extender, bodyweight ghost and isometric hold', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `rehab_${Date.now()}`);

  await page.click('nav >> text=PLAN');
  await page.click('button[role=radio]:text-is("Field & prevention")');
  await page.waitForSelector('[data-template=hamstring-rehab-2]');
  await page.waitForSelector('[data-template=hamstring-rehab-3]');
  await page.click('[data-template=hamstring-rehab-1] >> button:text-is("Start")');
  await page.waitForSelector('text=Active program');
  const [program] = await api('GET', '/api/programs', token);
  assert.equal(program.goal, 'Rehab');
  assert.deepEqual(program.days.map((d) => d.name), ['Strength', 'Bike + Extender']);

  await page.click('button:has-text("Start Strength")');
  const extender = page.locator('[data-block="258"]');
  await extender.locator('text=Slowly, stop before pain').waitFor();
  assert.equal(await extender.locator('[data-test=ghost-weight]').inputValue(), '0', 'bodyweight starts at 0 kg');
  assert.equal(await extender.locator('[data-test=ghost-reps]').inputValue(), '12');
  await extender.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');
  await extender.locator('[data-test=set-row]').waitFor();
  await page.waitForSelector('[data-block="261"] input[aria-label="s"]');
  assert.equal(await page.locator('[data-block="261"] input[aria-label="s"]').inputValue(), '30');
  assert.deepEqual(errors, []);
  await context.close();
});

test('gym extras: comma decimals, drag & drop order, hold timer for planks, replace an exercise without a ball', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `extras_${Date.now()}`);

  await page.click('[data-test=start-empty]');
  for (const [query, name] of [['bench press', 'Bench Press'], ['plank', 'Plank'], ['passing', 'Passing Drill']]) {
    await page.fill('[data-test=picker-search]', query);
    await page.click(`[role=option]:has-text("${name}") >> nth=0`);
  }
  await page.click('[data-test=picker-add]');
  const order = () => page.$$eval('[data-block]', (els) => els.map((e) => Number(e.getAttribute('data-block'))));
  assert.deepEqual(await order(), [1, 47, 238]);

  // iPhone-Tastatur hat nur ein Komma: "72,5" bleibt beim Tippen stehen und wird als 72.5 geloggt
  const bench = page.locator('[data-block="1"]');
  await bench.locator('[data-test=ghost-weight]').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('72,5');
  assert.equal(await bench.locator('[data-test=ghost-weight]').inputValue(), '72,5');
  await bench.locator('[data-test=ghost-reps]').fill('6');
  await bench.locator('[data-test=log-ghost]').click();
  await page.click('button[aria-label="Stop timer"]');
  await bench.locator('[data-test=set-row]:has-text("72.5")').waitFor();

  // Drag & drop: die Planke über das Bankdrücken ziehen
  const handle = page.locator('[data-block="47"] [data-test=drag-handle]');
  const from = await handle.boundingBox();
  const to = await page.locator('[data-block="1"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 10, { steps: 15 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('[data-block]')?.getAttribute('data-block') === '47');
  assert.deepEqual(await order(), [47, 1, 238]);

  // Timer für Zeit-Übungen: 3-2-1, dann läuft die Uhr; "Fertig" loggt die gehaltene Zeit
  const plank = page.locator('[data-block="47"]');
  await plank.locator('input[aria-label="s"]').fill('30');
  await plank.locator('[data-test=start-hold]').click();
  await page.waitForSelector('[data-test=hold-timer]');
  await page.waitForTimeout(4600);
  await page.click('[data-test=hold-done]');
  await page.waitForSelector('[data-test=hold-timer]', { state: 'detached' });
  await plank.locator('[data-test=set-row]').waitFor();
  const held = Number(await plank.locator('[data-test=set-row] span.text-base').last().innerText());
  assert.ok(held >= 1 && held <= 3, `held ${held} s`);
  await page.click('button[aria-label="Stop timer"]').catch(() => {});

  // Kein Ball da: Übung ersetzen -> passende Vorschläge ohne Ball
  await page.click('[data-block="238"] button[aria-label="Exercise options"]');
  await page.click('[data-test=sheet-replace]');
  const suggestion = page.locator('[data-replace]').first();
  await suggestion.waitFor();
  const replacement = Number(await suggestion.getAttribute('data-replace'));
  await suggestion.click();
  await page.waitForSelector('[data-block="238"]', { state: 'detached' });
  await page.waitForSelector(`[data-block="${replacement}"]`);
  assert.deepEqual(await order(), [47, 1, replacement]);

  await page.click('[data-test=finish-workout]');
  await page.waitForSelector('[data-test=finish-recovery]');
  await page.click('button:has-text("Save workout")');
  await page.waitForSelector('[data-test=summary-recovery] >> text=Upper body');
  await page.click('[data-test=summary-done]');
  const [w] = await api('GET', '/api/workouts/history', token);
  assert.deepEqual(w.sets.map((s) => [s.exerciseId, s.weight ?? null, s.reps ?? null]).filter((x) => x[0] === 1), [[1, 72.5, 6]]);
  assert.deepEqual(errors, []);
  await context.close();
});

test('offline at the gym: create a custom exercise without internet, it syncs with the workout later', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `gymoffline_${Date.now()}`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('h3:has-text("Bench Press")');
  await context.setOffline(true);
  await page.waitForSelector('text=Offline');

  await page.fill('input[type=search]', 'Box Landmine Press');
  await page.click('text=Create "Box Landmine Press"');
  await page.click('button:has-text("Create & log")');
  await page.waitForSelector('button:has-text("Log set")');
  await page.fill('#in-weight', '27,5');
  await page.fill('#in-reps', '8');
  await page.click('button:has-text("Log set")');
  await finishWorkout(page);
  await page.waitForSelector('text=Pending sync');
  assert.equal((await api('GET', '/api/workouts/history', token)).length, 0);

  await context.setOffline(false);
  await page.waitForSelector('text=Pending sync', { state: 'detached', timeout: 15000 });
  const custom = (await api('GET', '/api/exercises', token)).find((e) => e.name === 'Box Landmine Press');
  assert.ok(custom && custom.id > 0, 'custom exercise created on the server');
  const history = await api('GET', '/api/workouts/history', token);
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].sets.map((s) => [s.exerciseId, s.weight, s.reps]), [[custom.id, 27.5, 8]]);
  assert.deepEqual(errors, []);
  await context.close();
});

test('coach + plan for me: 4 answers start a program with a week plan around the match day', async () => {
  const { page, errors, context } = await newPage();
  const token = await register(page, `coach_${Date.now()}`);

  // Ohne Plan: der Coach bietet "Plan für mich" an
  await page.waitForSelector('[data-test=coach-card]');
  await page.click('[data-test=coach-build]');
  await page.waitForSelector('[data-test=plan-builder]');
  await page.click('[data-focus=football]');
  await page.click('[data-days="3"]');
  await page.click('[data-match="6"]');
  const first = page.locator('[data-choice]').first();
  await first.waitFor();
  const key = await first.getAttribute('data-choice');
  await first.locator('[data-start-choice]').click();
  await page.waitForSelector('[data-test=plan-builder]', { state: 'detached' });

  const deadline = Date.now() + 8000;
  let program;
  while (Date.now() < deadline) {
    [program] = await api('GET', '/api/programs', token);
    if (program?.matchDays) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.equal(program.templateKey, key);
  assert.equal(program.matchDays, 64, 'Sunday is the match day');
  assert.equal(program.trainingDays & 32, 0, 'no training the day before the match');
  assert.equal(program.trainingDays & 64, 0);
  assert.ok(program.trainingDays > 0);

  // Wochenplan im Plan-Tab bearbeiten: Montag umschalten und speichern
  await page.click('nav >> text=PLAN');
  await page.waitForSelector('[data-test=week-schedule]');
  await page.click('[data-test=schedule-edit]');
  const monday = page.locator('[data-test=week-schedule] [data-day="0"]');
  const before = program.trainingDays & 1;
  await monday.click();
  if (before) await monday.click(); // Training -> Spiel -> Ruhe
  await page.click('[data-test=schedule-save]');
  await page.waitForSelector('[data-test=schedule-today]');
  const deadline2 = Date.now() + 5000;
  let updated;
  while (Date.now() < deadline2) {
    [updated] = await api('GET', '/api/programs', token);
    if ((updated.trainingDays & 1) !== before) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.notEqual(updated.trainingDays & 1, before, 'Monday toggled');
  assert.equal(updated.matchDays, 64);

  // Start-Screen: Coach mit Empfehlung
  await page.click('nav >> text=GYM');
  const kind = await page.getAttribute('[data-test=coach-card]', 'data-coach');
  assert.ok(['train', 'light', 'rest', 'match'].includes(kind), kind);
  assert.deepEqual(errors, []);
  await context.close();
});

test('app icon: Halloween icon for the home screen and tab, remembered per device', async () => {
  const { page, errors, context } = await newPage();
  await register(page, `icon_${Date.now()}`);
  const touch = () => page.getAttribute('link[rel="apple-touch-icon"]', 'href');
  await page.click('button[aria-label=Settings]');
  await page.click('[data-icon-option=halloween]');
  await page.waitForFunction(() => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')?.includes('halloween'));
  assert.equal(await page.getAttribute('link[rel="icon"][type="image/svg+xml"]', 'href'), '/brand/icon-halloween.svg');
  assert.match(await page.innerText('[data-test=icon-hint]'), /Add to Home Screen/);
  // Vorschaubilder laden wirklich (SVG mit richtigem Content-Type)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-icon-option] img')].every((i) => i.complete && i.naturalWidth > 0));
  // Die Datei gibt es wirklich (sonst nähme iOS ein leeres Symbol)
  const res = await page.request.get(new URL(await touch(), page.url()).href);
  assert.equal(res.status(), 200);
  assert.equal(res.headers()['content-type'], 'image/png');
  await page.reload();
  await page.waitForSelector('[data-test=start-panel]');
  assert.equal(await touch(), '/brand/apple-touch-icon-halloween.png');
  await page.click('button[aria-label=Settings]');
  await page.click('[data-icon-option=default]');
  await page.waitForFunction(() => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') === '/apple-touch-icon.png');
  assert.deepEqual(errors, []);
  await context.close();
});
