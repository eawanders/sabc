// The inbound path for app-owned fields: what is read from Notion and handed
// to the sync_reconcile_* SQL functions (the per-field rule is pgTAP 08).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { marshalValues, reconcileCalls, seatValues, testSlotValues, unavailabilityValues } from './appOwned';
import { reconcilePage, syncSource } from './inbound';
import type { SyncNotion } from './notionApi';
import { sourceByKey } from './sources';
import { FakeDb, page, relation, select, status, text, title } from './testing';

const OUTING = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'aaaaaaaa-0000-4000-8000-000000000002';
const ADA = '00000000-0000-4000-8000-000000000001';
const EDITED = '2026-10-18T09:00:00.000Z';

const outingPage = (id = OUTING, extra: Record<string, unknown> = {}) =>
  page(
    id,
    {
      Name: title('M1'),
      Status: status('Provisional'),
      Bow: relation(ADA.replace(/-/g, '').toUpperCase()),
      'Bow Status': status('Available'),
      'Coach/Bank Rider': relation(),
      'Bank Rider Status': status('Reserved'),
      'Outing Summary': text('Solid'),
      ...extra,
    },
    { last_edited_time: EDITED },
  );

const notionReturning = (...pages: ReturnType<typeof page>[]): SyncNotion => ({
  queryDataSource: vi.fn(async () => ({ results: pages })),
  retrievePage: vi.fn(async () => pages[0]),
  updatePage: vi.fn(),
});

afterEach(() => vi.restoreAllMocks());

describe('Notion values for app-owned fields', () => {
  it('reads all 14 seats by their Notion relation and status names, ids canonical', () => {
    const seats = seatValues(outingPage());
    expect(seats).toHaveLength(14);
    expect(seats.find((s) => s.seat === 'Bow')).toEqual({ seat: 'Bow', member_id: ADA, status: 'Available' });
    expect(seats.find((s) => s.seat === 'Coach/Bank Rider')).toEqual({ seat: 'Coach/Bank Rider', member_id: null, status: 'Reserved' });
    expect(seats.map((s) => s.seat)).toContain('Sub 1');
  });

  it('parses the "Unavailable <Day>" JSON text like the current app, dropping extra keys and bad JSON', () => {
    const days = unavailabilityValues(
      page(ADA, {
        'Unavailable Monday': text('[{"start":"09:00","end":"12:00","note":"x"}]'),
        'Unavailable Tuesday': text('not json'),
      }),
    );
    expect(days.monday).toEqual([{ start: '09:00', end: '12:00' }]);
    expect(days.tuesday).toEqual([]);
    expect(Object.keys(days)).toHaveLength(7);
  });

  it('reads six test slots and the marshal sign-up (empty Person Status means Open)', () => {
    const slots = testSlotValues(page(OUTING, { 'Slot 2': relation(ADA), 'Slot 2 Outcome': status('Passed') }));
    expect(slots[1]).toEqual({ slot: 2, member_id: ADA, outcome: 'Passed' });
    expect(slots[0]).toEqual({ slot: 1, member_id: null, outcome: null });
    expect(marshalValues(page(OUTING, { Person: relation(ADA), 'Person Status': select('Confirmed') }))).toEqual({
      person_id: ADA,
      person_status: 'Confirmed',
    });
    expect(marshalValues(page(OUTING, {}))).toEqual({ person_id: null, person_status: 'Open' });
  });

  it('maps each data source to its reconcile calls; events have none; trashed pages are left out', () => {
    const live = outingPage();
    const trashed = { ...outingPage(OTHER), in_trash: true };
    const calls = reconcileCalls(sourceByKey('outings'), [live, trashed]);
    expect(calls.map((c) => c.kind)).toEqual(['seats', 'reports']);
    expect(calls[0].items).toEqual([{ outing_id: OUTING, edited_at: EDITED, seats: seatValues(live) }]);
    expect(calls[1].items[0]).toMatchObject({ outing_id: OUTING, fields: { outing_summary: 'Solid', boat_feel: null } });

    expect(reconcileCalls(sourceByKey('members'), [live]).map((c) => c.kind)).toEqual(['unavailability']);
    expect(reconcileCalls(sourceByKey('swim_tests'), [live]).map((c) => c.kind)).toEqual(['test_slots']);
    expect(reconcileCalls(sourceByKey('marshal_slots'), [live]).map((c) => c.kind)).toEqual(['marshal_slots']);
    expect(reconcileCalls(sourceByKey('events'), [live])).toEqual([]);
    expect(reconcileCalls(sourceByKey('outings'), [trashed])).toEqual([]);
  });
});

describe('inbound sync reconciles app-owned fields', () => {
  it('reconciles exactly the pages the incremental query returned, after upserting the outing', async () => {
    const db = new FakeDb();
    await db.saveRun('outings', { cursor: '2026-10-18T08:00:00.000Z', error: null });
    const order: string[] = [];
    vi.spyOn(db, 'upsert').mockImplementation(async (table) => void order.push(`upsert ${table}`));
    const reconcile = vi.spyOn(db, 'reconcileAppOwned');
    reconcile.mockImplementation(async (kind) => (order.push(`reconcile ${kind}`), db.reconcileResult));

    await syncSource(notionReturning(outingPage()), db, sourceByKey('outings'));

    expect(order).toEqual(['upsert outings', 'reconcile seats', 'reconcile reports']);
    expect(reconcile.mock.calls[0][1]).toEqual([{ outing_id: OUTING, edited_at: EDITED, seats: seatValues(outingPage()) }]);
  });

  it('tallies the result and warns about kept-newer and skipped fields', async () => {
    const db = new FakeDb();
    db.reconcileResult = {
      rows: 2,
      kept_pending: 1,
      kept_newer: [{ entity: 'outing_seats', key: { outing_id: OUTING, seat: 'Bow' }, field: 'member_id' }],
      skipped: [{ entity: 'outing_seats', key: { outing_id: OUTING, member_id: ADA }, reason: 'would put one member in two seats' }],
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await syncSource(notionReturning(outingPage()), db, sourceByKey('outings'));

    expect(result.appOwned).toEqual({ rows: 4, keptPending: 2, keptNewer: 2, skipped: 2 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('kept app values newer than Notion'), expect.stringContaining('Bow'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped'), expect.stringContaining('two seats'));
  });

  it('does not advance the cursor when the reconcile fails, so the pages are retried', async () => {
    const db = new FakeDb();
    await db.saveRun('outings', { cursor: '2026-10-18T08:00:00.000Z', error: null });
    vi.spyOn(db, 'reconcileAppOwned').mockRejectedValue(new Error('sync_reconcile_seats: boom'));

    const result = await syncSource(notionReturning(outingPage()), db, sourceByKey('outings'));

    expect(result.error).toContain('boom');
    expect((await db.getState('outings')).cursor).toBe('2026-10-18T08:00:00.000Z');
  });

  it('runs for members, swim tests and marshal slots, and not for events', async () => {
    for (const [key, kind] of [['members', 'unavailability'], ['swim_tests', 'test_slots'], ['marshal_slots', 'marshal_slots']] as const) {
      const db = new FakeDb();
      await syncSource(notionReturning(page(OUTING, { 'Full Name': title('Ada'), Name: title('x') })), db, sourceByKey(key));
      expect(db.reconcileCalls.map((c) => c.kind)).toEqual([kind]);
    }
    const db = new FakeDb();
    await syncSource(notionReturning(page(OUTING, { Event: title('Dinner') })), db, sourceByKey('events'));
    expect(db.reconcileCalls).toEqual([]);
  });

  it('a webhook re-read of one page reconciles it too', async () => {
    const db = new FakeDb();
    await reconcilePage(notionReturning(outingPage()), db, sourceByKey('outings'), OUTING);
    expect(db.reconcileCalls.map((c) => c.kind)).toEqual(['seats', 'reports']);
  });
});
