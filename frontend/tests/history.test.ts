import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mergeChanges, fetchChanges, sortHistory } from '../src/lib/history';

const w = (id: number, date: string, extra: { notes?: string } = {}) => ({ id, date, sets: [], ...extra });

test('sortHistory: newest first, ties broken by higher id', () => {
  const sorted = sortHistory([w(1, '2026-10-01'), w(3, '2026-10-02'), w(2, '2026-10-02')]);
  assert.deepEqual(sorted.map((x) => x.id), [3, 2, 1]);
});

test('mergeChanges replaces edited, adds new, removes deleted', () => {
  const cache = [w(1, '2026-10-01', { notes: 'old' }), w(2, '2026-10-02'), w(3, '2026-10-03')];
  const merged = mergeChanges(cache, { workouts: [w(1, '2026-10-01', { notes: 'new' }), w(4, '2026-10-04')], deletedIds: [2] });
  assert.deepEqual(merged.map((x) => x.id), [4, 3, 1]);
  assert.equal(merged.find((x) => x.id === 1).notes, 'new');
});

test('mergeChanges is idempotent (overlapping sync windows)', () => {
  const changes = { workouts: [w(5, '2026-10-05')], deletedIds: [1] };
  const once = mergeChanges([w(1, '2026-10-01')], changes);
  assert.deepEqual(mergeChanges(once, changes), once);
});

test('mergeChanges ignores deletions of unknown ids', () => {
  assert.deepEqual(mergeChanges([w(1, '2026-10-01')], { deletedIds: [99] }).map((x) => x.id), [1]);
});

test('fetchChanges follows cursors and keeps the token of the first page', async () => {
  const calls = [];
  const pages = [
    { workouts: [w(1, 'a')], deletedIds: [7], nextCursor: 'c1', syncToken: 'T1' },
    { workouts: [w(2, 'b')], deletedIds: [], nextCursor: null, syncToken: 'T2' },
  ];
  const api = { get: async (url) => { calls.push(url); return pages[calls.length - 1]; } };

  const result = await fetchChanges(api, '2026-10-01T00:00:00Z', { pageSize: 1 });

  assert.deepEqual(result.workouts.map((x) => x.id), [1, 2]);
  assert.deepEqual(result.deletedIds, [7]);
  assert.equal(result.token, 'T1');
  assert.match(calls[0], /since=2026-10-01T00%3A00%3A00Z/);
  assert.doesNotMatch(calls[0], /cursor=/);
  assert.match(calls[1], /cursor=c1/);
});

test('fetchChanges without since requests a full sync', async () => {
  let url = '';
  await fetchChanges({ get: async (u) => { url = u; return { workouts: [], deletedIds: [], nextCursor: null, syncToken: 'T' }; } });
  assert.doesNotMatch(url, /since=/);
});

test('fetchChanges stops after maxPages instead of looping forever', async () => {
  const api = { get: async () => ({ workouts: [], deletedIds: [], nextCursor: 'again', syncToken: 'T' }) };
  await assert.rejects(fetchChanges(api, null, { maxPages: 3 }), /too many pages/);
});
