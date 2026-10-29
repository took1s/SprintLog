import { describe, expect, test, vi } from 'vitest';
import { createRefreshingApi, ApiError } from '../src/lib/api';

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
