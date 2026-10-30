import { describe, expect, test, vi } from 'vitest';
import { createApi, createRefreshingApi, ApiError, REFRESH_RACE_DELAYS } from '../src/lib/api';

const res = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status });
const read = async <T,>(r: Response): Promise<T> => {
  if (!r.ok) throw new ApiError(r.status, `status ${r.status}`);
  return (r.status === 204 ? null : await r.json()) as T;
};

/** Gefälschter Server: Antworten pro "METHOD path" der Reihe nach. */
function server(routes: Record<string, number[]>) {
  const calls: { key: string; headers: Record<string, string> }[] = [];
  const send = vi.fn(async (method: string, path: string, _body?: unknown, headers: Record<string, string> = {}) => {
    const key = `${method} ${path}`;
    calls.push({ key, headers });
    const queue = routes[key] ?? [404];
    return res(queue.length > 1 ? queue.shift()! : queue[0], { ok: true });
  });
  return { send, calls };
}

describe('session refresh', () => {
  test('a 401 triggers one refresh and the request is retried', async () => {
    const { send, calls } = server({ 'GET /api/exercises': [401, 200], 'POST /api/auth/refresh': [200] });
    const onUnauthorized = vi.fn();
    const api = createRefreshingApi(send, read, { onUnauthorized });

    await expect(api.get('/api/exercises')).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.key)).toEqual(['GET /api/exercises', 'POST /api/auth/refresh', 'GET /api/exercises']);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('parallel 401s share a single refresh request', async () => {
    const { send, calls } = server({ 'GET /a': [401, 200], 'GET /b': [401, 200], 'POST /api/auth/refresh': [200] });
    const api = createRefreshingApi(send, read, {});
    await Promise.all([api.get('/a'), api.get('/b')]);
    expect(calls.filter((c) => c.key === 'POST /api/auth/refresh')).toHaveLength(1);
  });

  test('failed refresh logs the user out', async () => {
    const { send } = server({ 'GET /api/favorites': [401], 'POST /api/auth/refresh': [401] });
    const onUnauthorized = vi.fn();
    const api = createRefreshingApi(send, read, { onUnauthorized });
    await expect(api.get('/api/favorites')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  test('wrong password on login is an answer, not an expired session', async () => {
    const { send, calls } = server({ 'POST /api/auth/login': [401] });
    const onUnauthorized = vi.fn();
    const api = createRefreshingApi(send, read, { onUnauthorized });
    await expect(api.post('/api/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test('409 (another tab is rotating) is retried once', async () => {
    const { send, calls } = server({ 'POST /api/auth/refresh': [409, 200] });
    const api = createRefreshingApi(send, read, {});
    await expect(api.refreshSession()).resolves.toBe(true);
    expect(calls.filter((c) => c.key === 'POST /api/auth/refresh')).toHaveLength(2);
  });

  test('a persisting 409 is not an expired session: no logout, retryable error', async () => {
    vi.useFakeTimers();
    try {
      const { send, calls } = server({ 'GET /api/workouts/changes': [401], 'POST /api/auth/refresh': [409] });
      const onUnauthorized = vi.fn();
      const api = createRefreshingApi(send, read, { onUnauthorized });
      const result = api.get('/api/workouts/changes').catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      const error = await result;
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).isRetryable).toBe(true);
      expect(onUnauthorized).not.toHaveBeenCalled();
      expect(calls.filter((c) => c.key === 'POST /api/auth/refresh')).toHaveLength(1 + REFRESH_RACE_DELAYS.length);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a token of an older app version is sent once and then dropped', async () => {
    const { send, calls } = server({ 'POST /api/auth/refresh': [200] });
    let legacy: string | null = 'old.jwt.token';
    const api = createRefreshingApi(send, read, { getLegacyToken: () => legacy, onLegacyTokenUsed: () => { legacy = null; } });
    await api.refreshSession();
    await api.refreshSession();
    expect(calls[0].headers.Authorization).toBe('Bearer old.jwt.token');
    expect(calls[1].headers.Authorization).toBeUndefined();
  });
});

describe('transport timeout', () => {
  test('a response whose body never finishes is aborted (does not hang the caller)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"partial":'));
          init.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        },
      });
      return new Response(body, { status: 201 });
    }));
    try {
      const api = createApi({ timeoutMs: 50 });
      await expect(api.post('/api/workouts', {})).rejects.toMatchObject({ status: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('a normal JSON response is read as before', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ workoutId: 5 }), { status: 201 })));
    try {
      await expect(createApi().post('/api/workouts', {})).resolves.toEqual({ workoutId: 5 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('native app session (iOS)', () => {
  function nativeStore(refreshToken: string | null) {
    const store = {
      refreshToken,
      saved: [] as [string, string][],
      async save(access: string, refresh: string) { store.saved.push([access, refresh]); store.refreshToken = refresh; },
    };
    return store;
  }

  test('refresh sends the stored refresh token in the body and keeps the rotated tokens', async () => {
    const bodies: unknown[] = [];
    const send = vi.fn(async (_method: string, path: string, body?: unknown) => {
      bodies.push(body);
      if (path === '/api/auth/refresh') return res(200, { token: 'access-2', refreshToken: 'refresh-2', username: 'a', userId: 1 });
      return res(bodies.length === 1 ? 401 : 200, { ok: true });
    });
    const native = nativeStore('refresh-1');
    const api = createRefreshingApi(send, read, { native });

    await expect(api.get('/api/workouts')).resolves.toEqual({ ok: true });
    expect(bodies[1]).toEqual({ refreshToken: 'refresh-1' });
    expect(native.saved).toEqual([['access-2', 'refresh-2']]);
  });

  test('without a stored refresh token there is no refresh request', async () => {
    const { send, calls } = server({ 'GET /api/workouts': [401] });
    const onUnauthorized = vi.fn();
    const api = createRefreshingApi(send, read, { native: nativeStore(null), onUnauthorized });
    await expect(api.get('/api/workouts')).rejects.toMatchObject({ status: 401 });
    expect(calls.map((c) => c.key)).toEqual(['GET /api/workouts']);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  test('login response tokens are captured', async () => {
    const send = vi.fn(async () => res(200, { token: 'a1', refreshToken: 'r1', username: 'max', userId: 7 }));
    const native = nativeStore(null);
    const api = createRefreshingApi(send, read, { native });
    await expect(api.post('/api/auth/login', { username: 'max' })).resolves.toMatchObject({ userId: 7 });
    expect(native.saved).toEqual([['a1', 'r1']]);
  });
});
