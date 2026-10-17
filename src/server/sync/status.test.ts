// Ownership of outings.status between Notion (captains, Cancelled) and the app
// (auto-confirm). The SQL rule itself is tested in supabase/tests/05; these
// check the TypeScript paths route through it.
import { describe, expect, it, vi } from 'vitest';
import { reconcilePage, syncSource } from './inbound';
import type { SyncNotion } from './notionApi';
import { runOutbox } from './outbox';
import { sourceByKey } from './sources';
import { FakeDb, page, status, title } from './testing';

const OUTING = 'aaaaaaaa-0000-4000-8000-000000000001';
const outings = sourceByKey('outings');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');

const notionWith = (pages: ReturnType<typeof page>[]): SyncNotion => ({
  queryDataSource: vi.fn(async () => ({ results: pages })),
  retrievePage: vi.fn(async () => pages[0]),
  updatePage: vi.fn(async () => {}),
});

const outingPage = (notionStatus: string) => page(OUTING, { Name: title('M1'), Status: status(notionStatus) });

function seeded(dbStatus: string, pendingPayload?: Record<string, unknown>) {
  const db = new FakeDb();
  db.rows('outings').push({ id: OUTING, name: 'M1', status: dbStatus });
  if (pendingPayload) {
    db.outbox.push({
      id: 1,
      entity: 'outing',
      entity_key: { page_id: OUTING },
      payload: pendingPayload,
      revision: 1,
      attempts: 0,
      done: false,
      next_attempt_at: new Date(NOW - 1000).toISOString(),
    });
  }
  return db;
}

const statusPatch = (name: string) => ({ Status: { status: { name } } });

describe('inbound outings status', () => {
  it('never puts status in the plain upsert; it goes through the ownership RPC', async () => {
    const db = seeded('Provisional');
    await syncSource(notionWith([outingPage('Confirmed')]), db, outings);

    expect(db.upserts[0].rows[0]).not.toHaveProperty('status');
    expect(db.statusCalls).toEqual([[{ id: OUTING, status: 'Confirmed' }]]);
  });

  it('1. Notion Cancelled wins and drops the pending app Status patch', async () => {
    const db = seeded('Confirmed', statusPatch('Confirmed'));
    await syncSource(notionWith([outingPage('Cancelled')]), db, outings);

    expect(db.rows('outings')[0].status).toBe('Cancelled');
    expect(db.outbox[0]).toMatchObject({ done: true, payload: {} });
  });

  it('2. a pending app Status patch keeps the app value', async () => {
    const db = seeded('Confirmed', statusPatch('Confirmed'));
    await syncSource(notionWith([outingPage('Provisional')]), db, outings);

    expect(db.rows('outings')[0].status).toBe('Confirmed');
    expect(db.outbox[0]).toMatchObject({ done: false, payload: statusPatch('Confirmed') });
  });

  it('3. otherwise Notion status is written', async () => {
    const db = seeded('Confirmed', { 'Bow Status': { status: { name: 'Available' } } });
    await syncSource(notionWith([outingPage('Provisional')]), db, outings);

    expect(db.rows('outings')[0].status).toBe('Provisional');
  });

  it('applies the same rule when a webhook re-reads one page', async () => {
    const db = seeded('Confirmed', statusPatch('Confirmed'));
    await reconcilePage(notionWith([outingPage('Cancelled')]), db, outings, OUTING);

    expect(db.upserts[0].rows[0]).not.toHaveProperty('status');
    expect(db.rows('outings')[0].status).toBe('Cancelled');
  });
});

describe('outbox never resurrects a cancelled outing', () => {
  const options = { deadline: NOW + 50_000, clock: () => NOW, random: () => 0.5 };

  it('sends Cancelled instead of a queued live Status when the outing now reads Cancelled', async () => {
    const db = seeded('Cancelled', { ...statusPatch('Confirmed'), 'Bow Status': { status: { name: 'Available' } } });
    const notion = notionWith([]);
    await runOutbox(notion, db, options);

    expect(notion.updatePage).toHaveBeenCalledTimes(1);
    expect(notion.updatePage).toHaveBeenCalledWith(OUTING, {
      ...statusPatch('Cancelled'),
      'Bow Status': { status: { name: 'Available' } },
    });
    expect(db.outbox[0].done).toBe(true);
  });

  it('re-asserts Cancelled when the cancellation lands while the PATCH is in flight', async () => {
    const db = seeded('Confirmed', statusPatch('Confirmed'));
    const notion = notionWith([]);
    (notion.updatePage as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      db.rows('outings')[0].status = 'Cancelled';
    });
    await runOutbox(notion, db, options);

    expect(notion.updatePage).toHaveBeenNthCalledWith(1, OUTING, statusPatch('Confirmed'));
    expect(notion.updatePage).toHaveBeenNthCalledWith(2, OUTING, statusPatch('Cancelled'));
  });

  it('sends a live Status unchanged when the outing is not cancelled, without extra requests', async () => {
    const db = seeded('Confirmed', statusPatch('Confirmed'));
    const notion = notionWith([]);
    await runOutbox(notion, db, options);

    expect(notion.updatePage).toHaveBeenCalledTimes(1);
    expect(notion.updatePage).toHaveBeenCalledWith(OUTING, statusPatch('Confirmed'));
  });

  it('leaves payloads without Status, and non-outing rows, alone', async () => {
    const db = seeded('Cancelled', { 'Bow Status': { status: { name: 'Available' } } });
    const lookup = vi.spyOn(db, 'getOutingStatus');
    await runOutbox(notionWith([]), db, options);
    expect(lookup).not.toHaveBeenCalled();
  });
});
