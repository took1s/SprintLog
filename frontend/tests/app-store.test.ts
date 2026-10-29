// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { useAppStore } from '../src/stores/app';
import AuthView from '../src/components/AuthView.vue';
import type { Exercise } from '../src/types';

const bench: Exercise = { id: 1, name: 'Bench Press', category: 'Gym', muscleGroup: 'Chest', trackingType: 'WeightReps' };
const sprint: Exercise = { id: 12, name: 'Sprints', category: 'Football', muscleGroup: 'Legs', trackingType: 'DistanceTime' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Angemeldeter Store ohne echten Server. */
function signedIn() {
  const app = useAppStore();
  app.token = 'test-token';
  app.user = { userId: 7, username: 'tester' };
  app.exercises = [bench, sprint];
  return app;
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('set logging', () => {
  test('logging a set starts the session and the rest timer', () => {
    const app = signedIn();
    app.openSetModal(bench);
    expect(app.setModal.open).toBe(true);
    app.setModal.weight = 80;
    app.setModal.reps = 5;
    app.saveSet();

    expect(app.session.sets).toHaveLength(1);
    expect(app.session.sets[0]).toMatchObject({ exerciseId: 1, weight: 80, reps: 5, category: 'Gym' });
    expect(app.session.startedAt).not.toBeNull();
    expect(app.timerActive).toBe(true);
    expect(app.timer.duration).toBe(app.settings.restGym);
    expect(JSON.parse(localStorage.getItem('sprintlog:7:session')!).sets).toHaveLength(1);
  });

  test('invalid input is rejected without changing the session', () => {
    const app = signedIn();
    app.openSetModal(bench);
    app.setModal.reps = 0;
    app.saveSet();
    expect(app.session.sets).toHaveLength(0);
    expect(app.setModal.open).toBe(true);
  });

  test('next set is pre-filled from the previous set of the session', () => {
    const app = signedIn();
    app.openSetModal(sprint);
    app.setModal.distance = 40;
    app.setModal.time = 5.2;
    app.saveSet();
    app.openSetModal(sprint);
    expect([app.setModal.distance, app.setModal.time]).toEqual([40, 5.2]);
  });
});

describe('finishing a workout', () => {
  test('workout is queued first, then synced and the history reloaded via delta sync', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url === '/api/workouts') return json({ workoutId: 99, duplicate: false }, 201);
      if (url.startsWith('/api/workouts/changes')) {
        return json({ workouts: [{ id: 99, date: new Date().toISOString(), workoutType: 'Hybrid', sets: [] }], deletedIds: [], nextCursor: null, syncToken: '2026-10-29T10:00:00Z' });
      }
      return json({}, 404);
    }));

    const app = signedIn();
    app.openSetModal(bench);
    app.saveSet();
    app.openSetModal(sprint);
    app.saveSet();
    app.finishSession();
    app.finishModal.sessionRpe = 7;
    app.finishModal.durationMin = 60;
    await app.confirmFinish();

    expect(calls[0]).toBe('POST /api/workouts');
    expect(calls[1]).toMatch(/^GET \/api\/workouts\/changes\?limit=200$/); // erster Sync: ohne since
    expect(app.queue).toHaveLength(0);
    expect(app.history.map((w) => w.id)).toEqual([99]);
    expect(app.session.sets).toHaveLength(0);
    expect(app.tab).toBe('Data');
    expect(localStorage.getItem('sprintlog:7:historyToken')).toBe('"2026-10-29T10:00:00Z"');
  });

  test('offline: the workout stays in the queue and is shown as pending', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const app = signedIn();
    app.openSetModal(bench);
    app.saveSet();
    app.finishSession();
    await app.confirmFinish();

    expect(app.queue).toHaveLength(1);
    expect(app.online).toBe(false);
    expect(app.allWorkouts[0]).toMatchObject({ pending: true, workoutType: 'Gym' });
  });
});

describe('AuthView', () => {
  test('switches between login and registration and validates the password length', async () => {
    const wrapper = mount(AuthView, { global: { plugins: [createPinia()] } });
    expect(wrapper.text()).toContain('Sign in');

    await wrapper.get('button[type=button]').trigger('click');
    expect(wrapper.text()).toContain('Create new identity');

    await wrapper.get('#auth-user').setValue('athlete');
    await wrapper.get('#auth-pass').setValue('short');
    await wrapper.get('form').trigger('submit');
    expect(wrapper.text()).toContain('Password must be at least 8 characters.');
  });
});
