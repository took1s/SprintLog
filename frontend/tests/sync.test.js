import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncQueue, migrateLegacyQueue, toPayload, queueAsWorkouts, QueueStatus } from '../../SprintLog.Api/wwwroot/js/sync.js';
import { ApiError } from '../../SprintLog.Api/wwwroot/js/api.js';

const entry = (clientId, status = QueueStatus.Pending) => ({
  clientId, date: '2026-10-28T10:00:00Z', workoutType: 'Gym', status, attempts: 0,
  sets: [{ exerciseId: 1, exerciseName: 'Bench', weight: 80, reps: 5, distance: null, time: null }],
});

test('all entries are sent and removed on success', async () => {
  const sent = [];
  const result = await syncQueue([entry('a'), entry('b')], async (p) => sent.push(p.clientId));
  assert.deepEqual(sent, ['a', 'b']);
  assert.equal(result.synced, 2);
  assert.deepEqual(result.queue, []);
});

test('network error stops the sync and keeps the order', async () => {
  let calls = 0;
  const result = await syncQueue([entry('a'), entry('b'), entry('c')], async () => {
    calls += 1;
    if (calls === 2) throw new ApiError(0, 'offline');
  });
  assert.equal(result.synced, 1);
  assert.equal(result.stoppedBy, 'network');
  assert.deepEqual(result.queue.map((e) => e.clientId), ['b', 'c']);
});

test('validation error marks entry as failed but continues with the rest', async () => {
  const result = await syncQueue([entry('bad'), entry('good')], async (p) => {
    if (p.clientId === 'bad') throw new ApiError(400, 'Metrics cannot be negative.');
  });
  assert.equal(result.synced, 1);
  assert.equal(result.queue.length, 1);
  assert.equal(result.queue[0].status, QueueStatus.Failed);
  assert.equal(result.queue[0].error, 'Metrics cannot be negative.');
});

test('server error and 401 stop the sync without marking as failed', async () => {
  const server = await syncQueue([entry('a')], async () => { throw new ApiError(503, 'down'); });
  assert.equal(server.stoppedBy, 'server');
  assert.equal(server.queue[0].status, QueueStatus.Pending);
  assert.equal(server.queue[0].attempts, 1);

  const auth = await syncQueue([entry('a')], async () => { throw new ApiError(401, 'expired'); });
  assert.equal(auth.stoppedBy, 'auth');
  assert.equal(auth.queue[0].status, QueueStatus.Pending);
});

test('failed entries are skipped until the user retries them', async () => {
  const sent = [];
  await syncQueue([entry('x', QueueStatus.Failed), entry('y')], async (p) => sent.push(p.clientId));
  assert.deepEqual(sent, ['y']);
});

test('payload contains clientId, date and only API fields', () => {
  const p = toPayload(entry('a'));
  assert.equal(p.clientId, 'a');
  assert.equal(p.date, '2026-10-28T10:00:00Z');
  assert.deepEqual(Object.keys(p.sets[0]).sort(), ['distance', 'exerciseId', 'reps', 'time', 'weight']);
});

test('legacy v2 queue is migrated with new client ids and original timestamp', () => {
  let n = 0;
  const migrated = migrateLegacyQueue([
    { id: Date.UTC(2026, 5, 20), workoutType: 'Gym', status: 'pending', sets: [{ exerciseId: 1, name: 'Bench', weight: 50, reps: 5 }] },
    { id: 2, workoutType: 'Gym', status: 'synced', sets: [{ exerciseId: 1 }] },
  ], () => `id-${++n}`);
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].clientId, 'id-1');
  assert.equal(migrated[0].date, '2026-06-20T00:00:00.000Z');
  assert.equal(migrated[0].sets[0].exerciseName, 'Bench');
});

test('queue entries are shown like server workouts', () => {
  const [w] = queueAsWorkouts([entry('a')]);
  assert.equal(w.pending, true);
  assert.equal(w.sets[0].setNumber, 1);
  assert.equal(w.sets[0].exerciseName, 'Bench');
});
