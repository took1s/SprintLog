import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { loadClientConfig, scrubEvent, scrubUrl } from '../src/lib/monitoring';

const memory = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
});
afterEach(() => memory.clear());

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

test('tokens in query strings never leave the browser', () => {
  assert.equal(scrubUrl('https://sprintlog-api.onrender.com/?reset=abc123'), 'https://sprintlog-api.onrender.com/');
  assert.equal(scrubUrl('/api/workouts/history?since=x#top'), '/api/workouts/history');
  assert.equal(scrubUrl('/plain/path'), '/plain/path');

  const event = scrubEvent({
    request: { url: 'https://x.test/?confirm=secret', cookies: 'sl_rt=1', headers: { Cookie: 'a', 'User-Agent': 'UA', Authorization: 'Bearer t' }, query_string: 'confirm=secret' },
    breadcrumbs: [{ data: { url: '/api/auth/reset?token=1', to: '/?reset=2', from: '/', method: 'POST' } }],
  });
  assert.equal(event.request!.url, 'https://x.test/');
  assert.equal(event.request!.cookies, undefined);
  assert.equal(event.request!.query_string, undefined);
  assert.deepEqual(event.request!.headers, { 'User-Agent': 'UA' });
  assert.deepEqual(event.breadcrumbs![0].data, { url: '/api/auth/reset', to: '/', from: '/', method: 'POST' });
});

test('client config is cached for offline starts', async () => {
  const config = { sentryDsn: 'https://k@o1.ingest.sentry.io/1', environment: 'Production', release: 'sprintlog@abc' };
  assert.deepEqual(await loadClientConfig(() => ok(config)), config);
  assert.deepEqual(await loadClientConfig(() => Promise.reject(new TypeError('offline'))), config);
});

test('no config and no cache -> monitoring stays off', async () => {
  assert.equal(await loadClientConfig(() => Promise.resolve(new Response('', { status: 404 }))), null);
});
