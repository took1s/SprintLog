import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Api } from '@/lib/api';
import { createClientSync, type ClientSynced } from '@/lib/clientSync';

interface Item extends ClientSynced { title: string }

function setup(server: Item[], put: (url: string, body: unknown) => Promise<unknown>) {
  let items: Item[] = [];
  const rejected: string[] = [];
  const api = { get: vi.fn(async () => structuredClone(server)), put: vi.fn(put), del: vi.fn(async () => null) } as unknown as Api;
  const sync = createClientSync<Item>({
    path: '/api/x', items: () => items, setItems: (l) => { items = l; }, persist: () => {}, api: () => api,
    body: ({ title }) => ({ title }), onRejected: (i) => rejected.push(i.clientId),
  });
  return { sync, api, rejected, get items() { return items; }, set items(v: Item[]) { items = v; } };
}

describe('Offline-Sync mit Client-Id', () => {
  it('abgelehnte Änderung: Meldung, dann gilt wieder der gespeicherte Server-Stand (nichts verschwindet)', async () => {
    const s = setup([{ clientId: 'pl-a', title: 'Server', updatedAt: '1' }], async () => { throw new ApiError(409, 'plan_conflict'); });
    s.items = [{ clientId: 'pl-a', title: 'Verschoben', updatedAt: '2', pending: 'put' }];
    await s.sync.push();
    expect(s.rejected).toEqual(['pl-a']);
    expect(s.items).toEqual([{ clientId: 'pl-a', title: 'Server', updatedAt: '1' }]);
  });

  it('Funkloch: bleibt ausstehend; spätere Änderung während des Sendens wird nachgeschickt', async () => {
    let calls = 0;
    const s = setup([], async () => { calls++; if (calls === 1) throw new ApiError(0, 'offline'); return {}; });
    s.items = [{ clientId: 'rt-a', title: 'A', updatedAt: '1', pending: 'put' }];
    await s.sync.push();
    expect(s.items[0].pending).toBe('put');
    // Zweiter Versuch klappt, aber während des Sendens kommt eine neue Änderung -> danach noch einmal senden
    const first = s.sync.push();
    s.items = [{ clientId: 'rt-a', title: 'A2', updatedAt: '2', pending: 'put' }];
    await first;
    await s.sync.push();
    expect(s.items[0]).toMatchObject({ title: 'A2', pending: undefined });
    expect(calls).toBe(3);
  });
});
