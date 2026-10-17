import { describe, expect, it, vi } from 'vitest';
import { backfillAppOwned } from './backfill';
import type { SyncNotion } from './notionApi';
import { sourceByKey } from './sources';
import { FakeDb, page, relation, select, status, text, title } from './testing';

const OUTING = 'aaaaaaaa-0000-4000-8000-000000000001';
const TEST = 'aaaaaaaa-0000-4000-8000-000000000002';
const SLOT = 'aaaaaaaa-0000-4000-8000-000000000003';
const ADA = '00000000-0000-4000-8000-000000000001';
const BEN = '00000000-0000-4000-8000-000000000002';
const GHOST = '00000000-0000-4000-8000-000000000099';
const SEATS = ['Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow', 'Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Coach/Bank Rider'];

function seed() {
  const db = new FakeDb();
  db.rows('members').push({ id: ADA }, { id: BEN });
  db.rows('outings').push({ id: OUTING });
  for (const seat of SEATS) db.rows('outing_seats').push({ outing_id: OUTING, seat, member_id: null, status: null, version: 0 });
  db.rows('swim_tests').push({ id: TEST });
  for (let slot = 1; slot <= 6; slot++) db.rows('swim_test_slots').push({ test_id: TEST, slot, member_id: null, outcome: null, version: 0 });
  db.rows('marshal_slots').push({ id: SLOT, name: 'S1', person_id: null, person_status: 'Open', version: 0 });
  return db;
}

const pagesBySource: Record<string, ReturnType<typeof page>[]> = {
  [sourceByKey('outings').dataSourceId]: [
    page(OUTING, {
      Cox: relation(ADA),
      'Cox Status': status('Available'),
      Bow: relation(GHOST),
      'Bow Status': status('Reserved'),
      'Sub 1': relation(BEN),
      'Sub 1 Status': status('Maybe Available'),
      'Outing Summary': text('Solid'),
      'Coach Feedback': text('Sit up'),
    }),
  ],
  [sourceByKey('members').dataSourceId]: [
    page(ADA, { 'Full Name': title('Ada'), 'Unavailable Monday': text('[{"start":"09:00","end":"12:00"}]') }),
    page(BEN, { 'Full Name': title('Ben'), 'Unavailable Monday': text('') }),
  ],
  [sourceByKey('swim_tests').dataSourceId]: [
    page(TEST, { 'Slot 1': relation(BEN), 'Slot 1 Outcome': status('Passed'), 'Slot 2 Outcome': status('Bogus') }),
  ],
  [sourceByKey('marshal_slots').dataSourceId]: [page(SLOT, { Person: relation(ADA), 'Person Status': select('Confirmed') })],
};

const notion: SyncNotion = {
  queryDataSource: vi.fn(async (id: string) => ({ results: pagesBySource[id] ?? [] })),
  retrievePage: vi.fn(),
  updatePage: vi.fn(),
};

describe('backfillAppOwned', () => {
  it('copies seats, reports, unavailability, slot bookings and marshal sign-ups from Notion', async () => {
    const db = seed();
    const result = await backfillAppOwned(notion, db);

    const seat = (name: string) => db.rows('outing_seats').find((s) => s.seat === name);
    expect(seat('Cox')).toMatchObject({ member_id: ADA, status: 'Available' });
    expect(seat('Sub 1')).toMatchObject({ member_id: BEN, status: 'Maybe Available' });
    // A relation to a member Postgres does not have is dropped (FK), the status kept.
    expect(seat('Bow')).toMatchObject({ member_id: null, status: 'Reserved' });
    expect(result.seats).toMatchObject({ written: 3, unknownRefs: 1 });

    expect(db.rows('outing_reports')).toEqual([
      expect.objectContaining({ outing_id: OUTING, outing_summary: 'Solid', coach_feedback: 'Sit up', boat_feel: null }),
    ]);
    expect(db.rows('member_unavailability')).toEqual([
      expect.objectContaining({ member_id: ADA, monday: [{ start: '09:00', end: '12:00' }], tuesday: [] }),
    ]);
    expect(db.rows('swim_test_slots').find((s) => s.slot === 1)).toMatchObject({ member_id: BEN, outcome: 'Passed' });
    expect(db.rows('swim_test_slots').find((s) => s.slot === 2)).toMatchObject({ outcome: null });
    expect(db.rows('marshal_slots')[0]).toMatchObject({ person_id: ADA, person_status: 'Confirmed', name: 'S1' });
  });

  it('is idempotent: a second run writes nothing', async () => {
    const db = seed();
    await backfillAppOwned(notion, db);
    db.upserts = [];
    const update = vi.spyOn(db, 'updateWhere');

    const again = await backfillAppOwned(notion, db);

    expect(db.upserts).toEqual([]);
    expect(update).not.toHaveBeenCalled();
    expect(again.seats.written).toBe(0);
    expect(again.unavailability.written).toBe(0);
  });

  it('keeps rows the app already changed unless overwrite is set', async () => {
    const db = seed();
    Object.assign(db.rows('outing_seats').find((s) => s.seat === 'Cox')!, { member_id: BEN, status: 'Reserved', version: 2 });

    const kept = await backfillAppOwned(notion, db, { dryRun: true });
    expect(kept.seats.keptAppChanges).toBe(1);

    await backfillAppOwned(notion, db);
    expect(db.rows('outing_seats').find((s) => s.seat === 'Cox')).toMatchObject({ member_id: BEN });

    await backfillAppOwned(notion, db, { overwrite: true });
    expect(db.rows('outing_seats').find((s) => s.seat === 'Cox')).toMatchObject({ member_id: ADA, status: 'Available' });
  });

  it('writes nothing on a dry run', async () => {
    const db = seed();
    const result = await backfillAppOwned(notion, db, { dryRun: true });
    expect(result.seats.written).toBe(3);
    expect(db.upserts).toEqual([]);
    expect(db.rows('marshal_slots')[0].person_id).toBeNull();
  });
});
