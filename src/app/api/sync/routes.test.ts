import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeDb } from '@/server/sync/testing';

const db = new FakeDb();
const syncAll = vi.fn(async () => [{ source: 'members', upserted: 0, deleted: 0, skipped: 0, complete: true }]);
const runOutbox = vi.fn(async () => ({ sent: 0, stale: 0, failed: 0, rateLimited: false }));
const syncSource = vi.fn(async () => ({}));
const reconcilePage = vi.fn(async () => 'upserted');
const afterTasks: (() => Promise<unknown> | unknown)[] = [];

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => void afterTasks.push(task),
}));
vi.mock('@/server/sync/db', () => ({ createServiceRoleSyncDb: () => db }));
vi.mock('@/server/sync/notionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/sync/notionApi')>()),
  createSyncNotion: () => ({}),
}));
vi.mock('@/server/sync/inbound', () => ({ syncAll, syncSource, reconcilePage }));
vi.mock('@/server/sync/outbox', () => ({ runOutbox }));

const { POST: run } = await import('./run/route');
const { POST: webhook } = await import('./notion-webhook/route');

beforeEach(() => {
  db.syncSecret = 'tick-secret';
  vi.stubEnv('NOTION_WEBHOOK_VERIFICATION_TOKEN', 'secret_hook');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  afterTasks.length = 0;
  db.tokens = [];
});

const runRequest = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/sync/run', { method: 'POST', headers });

describe('POST /api/sync/run', () => {
  it('rejects a missing or wrong secret without syncing', async () => {
    expect((await run(runRequest())).status).toBe(401);
    expect((await run(runRequest({ 'x-sync-secret': 'nope' }))).status).toBe(401);
    expect(syncAll).not.toHaveBeenCalled();
    expect(runOutbox).not.toHaveBeenCalled();
  });

  it('checks the secret against the database (Vault), not an env var', async () => {
    vi.stubEnv('SYNC_SHARED_SECRET', 'env-secret');
    expect((await run(runRequest({ 'x-sync-secret': 'env-secret' }))).status).toBe(401);
    expect((await run(runRequest({ 'x-sync-secret': 'tick-secret' }))).status).toBe(200);
  });

  it('rejects everything when no secret is stored', async () => {
    db.syncSecret = null;
    expect((await run(runRequest({ 'x-sync-secret': '' }))).status).toBe(401);
    expect((await run(runRequest({ 'x-sync-secret': 'tick-secret' }))).status).toBe(401);
    expect(syncAll).not.toHaveBeenCalled();
  });

  it('runs the inbound sweep then the outbox with the right secret', async () => {
    const res = await run(runRequest({ 'x-sync-secret': 'tick-secret' }));
    expect(res.status).toBe(200);
    expect(syncAll).toHaveBeenCalledWith({}, db, expect.objectContaining({ full: false }));
    expect(runOutbox).toHaveBeenCalledWith({}, db, expect.objectContaining({ deadline: expect.any(Number) }));
  });
});

const hookRequest = (body: unknown, signature?: string) => {
  const raw = JSON.stringify(body);
  return new NextRequest('http://localhost/api/sync/notion-webhook', {
    method: 'POST',
    body: raw,
    headers: signature === undefined ? {} : { 'x-notion-signature': signature },
  });
};
const sign = (body: unknown, key = 'secret_hook') =>
  `sha256=${createHmac('sha256', key).update(JSON.stringify(body)).digest('hex')}`;

describe('POST /api/sync/notion-webhook', () => {
  const event = {
    type: 'page.properties_updated',
    entity: { id: 'aaaaaaaa-0000-4000-8000-000000000001', type: 'page' },
    data: { parent: { id: '23d80040-a8fa-80ed-afaf-f6c83477d5d0', type: 'database', data_source_id: '23d80040-a8fa-80e1-a538-000bc51d1f0d' } },
  };

  it('rejects an invalid or missing signature', async () => {
    expect((await webhook(hookRequest(event, sign(event, 'wrong')))).status).toBe(401);
    expect((await webhook(hookRequest(event))).status).toBe(401);
    expect(afterTasks).toHaveLength(0);
  });

  it('accepts a signed event and syncs its data source after responding', async () => {
    const res = await webhook(hookRequest(event, sign(event)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ accepted: 'sync-source', source: 'outings' });
    expect(syncSource).not.toHaveBeenCalled();
    await afterTasks[0]();
    expect(syncSource).toHaveBeenCalledWith({}, db, expect.objectContaining({ key: 'outings' }), expect.anything());
  });

  it('debounces a sync that ran moments ago', async () => {
    await db.saveRun('outings', { error: null });
    await webhook(hookRequest(event, sign(event)));
    await afterTasks[0]();
    expect(syncSource).not.toHaveBeenCalled();
    db.state.clear();
  });

  it('stores the one-time verification token before it is configured, and ignores it after', async () => {
    vi.stubEnv('NOTION_WEBHOOK_VERIFICATION_TOKEN', '');
    expect((await webhook(hookRequest({ verification_token: 'secret_new' }))).status).toBe(200);
    expect(db.tokens).toEqual(['secret_new']);

    vi.stubEnv('NOTION_WEBHOOK_VERIFICATION_TOKEN', 'secret_hook');
    await webhook(hookRequest({ verification_token: 'secret_again' }));
    expect(db.tokens).toEqual(['secret_new']);
  });
});
