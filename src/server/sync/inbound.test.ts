import { describe, expect, it, vi } from 'vitest';
import type { SyncNotion } from './notionApi';
import { reconcilePage, syncAll, syncSource } from './inbound';
import { sourceByKey } from './sources';
import { FakeDb, check, page, relation, select, status, title } from './testing';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'aaaaaaaa-0000-4000-8000-000000000002';
const MEMBER = '00000000-0000-4000-8000-000000000001';
const outings = sourceByKey('outings');

function notionReturning(...batches: ReturnType<typeof page>[][]): SyncNotion & { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = [];
  let call = 0;
  return {
    bodies,
    queryDataSource: vi.fn(async (_id: string, body: Record<string, unknown>) => {
      bodies.push(body);
      const results = batches[call] ?? [];
      call++;
      return { results, has_more: call < batches.length, next_cursor: call < batches.length ? `c${call}` : null };
    }),
    retrievePage: vi.fn(),
    updatePage: vi.fn(),
  };
}

const outingPage = (id: string, edited: string, extra: Record<string, unknown> = {}) =>
  page(id, { Name: title(`Outing ${id.slice(-1)}`), Status: status('Confirmed'), ...extra }, { last_edited_time: edited });

describe('syncSource', () => {
  it('does a full read the first time, sorted oldest first, and stores the newest edit as the cursor', async () => {
    const db = new FakeDb();
    const notion = notionReturning([outingPage(A, '2026-10-17T09:00:00.000Z'), outingPage(B, '2026-10-17T09:05:00.000Z')]);
    const result = await syncSource(notion, db, outings);

    expect(notion.bodies[0]).not.toHaveProperty('filter');
    expect(notion.bodies[0].sorts).toEqual([{ timestamp: 'last_edited_time', direction: 'ascending' }]);
    expect(result).toMatchObject({ upserted: 2, complete: true });
    expect((await db.getState('outings')).cursor).toBe('2026-10-17T09:05:00.000Z');
  });

  it('filters by the cursor on the next run and advances it', async () => {
    const db = new FakeDb();
    await db.saveRun('outings', { cursor: '2026-10-17T09:05:00.000Z', error: null });
    const notion = notionReturning([outingPage(B, '2026-10-17T09:05:00.000Z')], [outingPage(A, '2026-10-17T09:30:00.000Z')]);
    await syncSource(notion, db, outings);

    expect(notion.bodies[0].filter).toEqual({
      timestamp: 'last_edited_time',
      last_edited_time: { on_or_after: '2026-10-17T09:05:00.000Z' },
    });
    expect(notion.bodies[1].start_cursor).toBe('c1');
    expect((await db.getState('outings')).cursor).toBe('2026-10-17T09:30:00.000Z');
  });

  it('upserts only Notion-owned columns, leaving seats untouched', async () => {
    const db = new FakeDb();
    db.rows('outing_seats').push({ outing_id: A, seat: 'Cox', member_id: MEMBER, status: 'Reserved', version: 3 });
    const notion = notionReturning([
      outingPage(A, '2026-10-17T09:00:00.000Z', { Cox: relation('00000000-0000-4000-8000-000000000009'), 'Cox Status': status('Available'), 'Publish Outing': check(true) }),
    ]);
    await syncSource(notion, db, outings);

    expect(db.upserts.map((u) => u.table)).toEqual(['outings']);
    expect(db.upserts[0].rows[0]).not.toHaveProperty('Cox');
    expect(db.rows('outing_seats')[0]).toMatchObject({ member_id: MEMBER, status: 'Reserved', version: 3 });
  });

  it('upserts marshal slot definitions without person_id / person_status', async () => {
    const db = new FakeDb();
    db.rows('marshal_slots').push({ id: A, name: 'Old', person_id: MEMBER, person_status: 'Confirmed', version: 2 });
    const notion = notionReturning([
      page(A, { Name: title('Longbridges S1'), Person: relation(B), 'Person Status': select('Open') }),
    ]);
    await syncSource(notion, db, sourceByKey('marshal_slots'));

    expect(Object.keys(db.upserts[0].rows[0])).not.toEqual(expect.arrayContaining(['person_id']));
    expect(db.upserts[0].rows[0]).not.toHaveProperty('person_status');
    expect(db.rows('marshal_slots')[0]).toMatchObject({ name: 'Longbridges S1', person_id: MEMBER, person_status: 'Confirmed' });
  });

  it('deletes rows for archived / in_trash pages', async () => {
    const db = new FakeDb();
    db.rows('outings').push({ id: A }, { id: B });
    const notion = notionReturning([
      outingPage(A, '2026-10-17T09:00:00.000Z'),
      { ...outingPage(B, '2026-10-17T09:01:00.000Z'), in_trash: true },
    ]);
    const result = await syncSource(notion, db, outings);

    expect(result.deleted).toBe(1);
    expect(db.rows('outings').map((r) => r.id)).toEqual([A]);
  });

  it('on a full sweep deletes rows whose page has gone, but never from an empty result', async () => {
    const db = new FakeDb();
    db.rows('outings').push({ id: A }, { id: B });
    await syncSource(notionReturning([outingPage(A, '2026-10-17T09:00:00.000Z')]), db, outings, { full: true });
    expect(db.rows('outings').map((r) => r.id)).toEqual([A]);

    await syncSource(notionReturning([]), db, outings, { full: true });
    expect(db.rows('outings').map((r) => r.id)).toEqual([A]);
  });

  it('stops at the deadline, keeping the cursor of what it did upsert', async () => {
    const db = new FakeDb();
    let now = 0;
    const notion = notionReturning([outingPage(A, '2026-10-17T09:00:00.000Z')], [outingPage(B, '2026-10-17T10:00:00.000Z')]);
    (notion.queryDataSource as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      now = 100;
      return { results: [outingPage(A, '2026-10-17T09:00:00.000Z')], has_more: true, next_cursor: 'c1' };
    });
    const result = await syncSource(notion, db, outings, { deadline: 50, clock: () => now });

    expect(result.complete).toBe(false);
    expect(notion.queryDataSource).toHaveBeenCalledTimes(1);
    expect((await db.getState('outings')).cursor).toBe('2026-10-17T09:00:00.000Z');
  });

  it('records an error without moving the cursor', async () => {
    const db = new FakeDb();
    await db.saveRun('outings', { cursor: '2026-10-17T09:00:00.000Z', error: null });
    const notion = notionReturning();
    (notion.queryDataSource as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }));
    const result = await syncSource(notion, db, outings);

    expect(result.error).toContain('429');
    expect(await db.getState('outings')).toMatchObject({ cursor: '2026-10-17T09:00:00.000Z' });
    expect(db.state.get('outings')?.last_error).toContain('rate limited');
  });
});

describe('syncAll', () => {
  it('syncs members, outings, events, swim tests, marshal slots in that order', async () => {
    const db = new FakeDb();
    const notion = notionReturning();
    const ids: string[] = [];
    (notion.queryDataSource as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      ids.push(id);
      return { results: [] };
    });
    const results = await syncAll(notion, db);
    expect(results.map((r) => r.source)).toEqual(['members', 'outings', 'events', 'swim_tests', 'marshal_slots']);
    expect(ids[0]).toBe(sourceByKey('members').dataSourceId);
  });
});

describe('reconcilePage', () => {
  it('deletes a trashed page and upserts a restored one', async () => {
    const db = new FakeDb();
    db.rows('outings').push({ id: A });
    const notion = notionReturning();
    (notion.retrievePage as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ...outingPage(A, '2026-10-17T09:00:00.000Z'), in_trash: true })
      .mockResolvedValueOnce(outingPage(A, '2026-10-17T09:10:00.000Z'));

    expect(await reconcilePage(notion, db, outings, A)).toBe('deleted');
    expect(db.rows('outings')).toHaveLength(0);
    expect(await reconcilePage(notion, db, outings, A)).toBe('upserted');
    expect(db.rows('outings')).toHaveLength(1);
  });
});
