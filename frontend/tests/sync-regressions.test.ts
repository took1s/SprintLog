// @vitest-environment happy-dom
// Regressionstests aus dem Audit: Offline-Sync darf keine Änderungen verlieren und keine lokalen IDs senden.
import { beforeEach, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '../src/stores/app';
import { useUiStore } from '../src/stores/ui';
import type { Exercise } from '../src/types';

const bench: Exercise = { id: 1, name: 'Bench Press', category: 'Gym', muscleGroup: 'Chest', trackingType: 'WeightReps' } as Exercise;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const offline = () => vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
const tick = () => new Promise((r) => setTimeout(r, 0));
const emptyHistory = { workouts: [], deletedIds: [], nextCursor: null, syncToken: 't' };

function signedIn() {
  const app = useAppStore();
  app.user = { userId: 7, username: 'tester' } as typeof app.user;
  app.exercises = [bench];
  return app;
}
async function queueOne(app: ReturnType<typeof signedIn>, ex: Exercise = bench) {
  app.openSetModal(ex); app.saveSet(); app.finishSession(); await app.confirmFinish(); app.closeSummary();
}

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); vi.restoreAllMocks(); });

test('an entry discarded while a sync is in flight stays discarded', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({ title: 'bad' }, 400)));
  const app = signedIn();
  await queueOne(app);
  expect(app.queue[0].status).toBe('failed');
  offline();
  await queueOne(app);
  let release!: () => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/workouts'
    ? new Promise<Response>((r) => { release = () => r(json({ workoutId: 5, duplicate: false }, 201)); })
    : Promise.resolve(json(emptyHistory)))));
  const sync = app.syncNow({ reload: false });
  await tick();
  const failed = app.allWorkouts.find((w) => w.status === 'failed')!;
  const del = app.deleteWorkout(failed); await tick(); useUiStore().resolveDialog(true); await del;
  release(); await sync;
  expect(app.queue).toEqual([]);
});

test('a create that the server already has is followed by a PUT with the current state', async () => {
  offline();
  const app = signedIn();
  await queueOne(app);
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/workouts') return json({ workoutId: 42, duplicate: true, message: 'Workout already saved.' });
    if (url === '/api/workouts/42') return json({ id: 42 });
    return json(emptyHistory);
  }));
  await app.syncNow({ reload: false });
  expect(calls).toContain('POST /api/workouts');
  expect(calls).toContain('PUT /api/workouts/42');
  expect(app.queue).toEqual([]);
});

test('offline exercise: favorite, open set dialog and hold timer follow the new server id', async () => {
  offline();
  const app = signedIn();
  app.customModal = { ...app.customModal, open: true, name: 'Side Plank X', category: 'Gym', muscleGroup: 'Core', trackingType: 'Duration', addToWorkout: true };
  await app.saveCustomExercise();
  const local = app.exercises.find((e) => e.id < 0)!;
  await app.toggleFavorite(local);
  app.openSetModal(local);
  app.startHold(local.id);
  const posts: string[] = [];
  const serverFavorites: number[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push(url);
    if (url.startsWith('/api/favorites/') && init?.method === 'POST') { serverFavorites.push(Number(url.split('/').pop())); return json({}); }
    if (url === '/api/exercises' && init?.method === 'POST') return json({ ...local, id: 502 }, 201);
    if (url === '/api/exercises') return json([bench, { ...local, id: 502 }]);
    if (url === '/api/favorites') return json(serverFavorites);
    if (url.startsWith('/api/workouts')) return json(emptyHistory);
    return json([]);
  }));
  await app.refreshAll();
  expect(app.exercises.some((e) => e.id < 0)).toBe(false);
  expect(app.setModal.exercise?.id).toBe(502);
  expect(app.holdTimer?.exerciseId).toBe(502);
  expect(posts).toContain('/api/favorites/502');
  expect(app.favorites).toContain(502);
  expect(JSON.parse(localStorage.getItem('sprintlog:7:favoritesPending') ?? '{}')).toEqual({});
});

test('an exercise used by an unsynced workout cannot be deleted', async () => {
  offline();
  const app = signedIn();
  app.customModal = { ...app.customModal, open: true, name: 'My Curl X', category: 'Gym', muscleGroup: 'Biceps', trackingType: 'WeightReps', addToWorkout: false };
  await app.saveCustomExercise();
  const local = app.exercises.find((e) => e.id < 0)!;
  await queueOne(app, local);
  const confirm = vi.spyOn(useUiStore(), 'confirm');
  await app.deleteCustomExercise(local);
  expect(confirm).not.toHaveBeenCalled();
  expect(app.exercises.some((e) => e.id === local.id)).toBe(true);
});
