// One-off backfill of APP-OWNED data from Notion into Postgres, so the beta
// opens with today's real crews. Never runs automatically: see
// scripts/sync-backfill.ts. Run it after a full inbound sync (members and the
// definition tables must exist first, for the foreign keys).
//
// Idempotent: it reads what Postgres holds and writes only rows that differ, so
// a second run writes nothing. Rows the app has already changed (version > 0)
// are left alone unless `overwrite` is set, so a late re-run cannot undo a
// member's claim with Notion's stale value.
import { SEAT_STATUSES } from '@/lib/seatProperties';
import { DAYS_OF_WEEK, type TimeRange } from '@/types/rowerAvailability';
import { REPORT_FIELDS, marshalValues, reportValues, seatValues, testSlotValues, unavailabilityValues } from './appOwned';
import type { SyncDb } from './db';
import type { SyncNotion } from './notionApi';
import { canonicalId, isTrashed, sourceByKey, type NotionPage, type Row } from './sources';

export interface BackfillOptions {
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface BackfillCounts {
  written: number;
  unchanged: number;
  /** Already changed in the app (version > 0) and left alone. */
  keptAppChanges: number;
  /** Notion pointed at a member or row that Postgres does not have. */
  unknownRefs: number;
}

export interface BackfillResult {
  seats: BackfillCounts;
  reports: BackfillCounts;
  unavailability: BackfillCounts;
  swimTestSlots: BackfillCounts;
  marshalSignups: BackfillCounts;
}

const TEST_OUTCOMES = new Set(['No Show', 'Test Booked', 'Failed', 'Passed']);
const MARSHAL_STATUSES = new Set(['Open', 'Reserved', 'Maybe Available', 'Awaiting Approval', 'Confirmed', 'Not Available']);

const counts = (): BackfillCounts => ({ written: 0, unchanged: 0, keptAppChanges: 0, unknownRefs: 0 });

export async function queryAllPages(notion: SyncNotion, dataSourceId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let startCursor: string | undefined;
  do {
    const res = await notion.queryDataSource(dataSourceId, {
      page_size: 100,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    });
    pages.push(...(res.results ?? []).filter((p) => !isTrashed(p)));
    startCursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (startCursor);
  return pages;
}


function keyed(rows: Row[], ...cols: string[]) {
  return new Map(rows.map((r) => [cols.map((c) => String(r[c])).join('|'), r]));
}

/** Decides one row: unchanged, kept (app already changed it) or to be written. */
function decide(existing: Row | undefined, wanted: Row, compare: string[], overwrite: boolean, c: BackfillCounts) {
  if (existing && compare.every((k) => JSON.stringify(existing[k] ?? null) === JSON.stringify(wanted[k] ?? null))) {
    c.unchanged++;
    return false;
  }
  if (existing && Number(existing.version) > 0 && !overwrite) {
    c.keptAppChanges++;
    return false;
  }
  c.written++;
  return true;
}

export async function backfillAppOwned(
  notion: SyncNotion,
  db: SyncDb,
  options: BackfillOptions = {},
): Promise<BackfillResult> {
  const overwrite = options.overwrite ?? false;
  const result: BackfillResult = {
    seats: counts(),
    reports: counts(),
    unavailability: counts(),
    swimTestSlots: counts(),
    marshalSignups: counts(),
  };
  const memberIds = new Set((await db.selectAll('members', 'id')).map((r) => String(r.id)));
  const member = (id: string | null, c: BackfillCounts): string | null => {
    if (!id) return null;
    if (memberIds.has(id)) return id;
    c.unknownRefs++;
    return null;
  };

  // ---- seats and outing reports (Outings data source)
  const outingPages = await queryAllPages(notion, sourceByKey('outings').dataSourceId);
  const outingIds = new Set((await db.selectAll('outings', 'id')).map((r) => String(r.id)));
  const seats = keyed(await db.selectAll('outing_seats', 'outing_id,seat,member_id,status,version'), 'outing_id', 'seat');
  const reports = keyed(
    await db.selectAll('outing_reports', `outing_id,${Object.keys(REPORT_FIELDS).join(',')},version`),
    'outing_id',
  );
  const seatRows: Row[] = [];
  const reportRows: Row[] = [];
  for (const page of outingPages) {
    const outingId = canonicalId(page.id);
    if (!outingIds.has(outingId)) {
      result.seats.unknownRefs++;
      continue;
    }
    for (const { seat, member_id, status } of seatValues(page)) {
      const wanted = {
        outing_id: outingId,
        seat,
        member_id: member(member_id, result.seats),
        status: status && SEAT_STATUSES.includes(status) ? status : null,
      };
      if (decide(seats.get(`${outingId}|${seat}`), wanted, ['member_id', 'status'], overwrite, result.seats)) {
        seatRows.push(wanted);
      }
    }
    const report: Row = { outing_id: outingId, ...reportValues(page) };
    const existing = reports.get(outingId);
    const empty = Object.keys(REPORT_FIELDS).every((col) => report[col] === null);
    if (!existing && empty) continue;
    if (decide(existing, report, Object.keys(REPORT_FIELDS), overwrite, result.reports)) reportRows.push(report);
  }

  // ---- weekly unavailability (Members data source, "Unavailable <Day>" JSON text)
  const memberPages = await queryAllPages(notion, sourceByKey('members').dataSourceId);
  const unavailability = keyed(
    await db.selectAll('member_unavailability', `member_id,${DAYS_OF_WEEK.join(',')},version`),
    'member_id',
  );
  const normalise = (ranges: unknown): TimeRange[] =>
    (Array.isArray(ranges) ? ranges : []).map((r: TimeRange) => ({ start: r.start, end: r.end }));
  const unavailabilityRows: Row[] = [];
  for (const page of memberPages) {
    const memberId = canonicalId(page.id);
    if (!memberIds.has(memberId)) continue; // nameless members are not synced
    const wanted: Row = { member_id: memberId, ...unavailabilityValues(page) };
    const existing = unavailability.get(memberId);
    if (!existing && DAYS_OF_WEEK.every((d) => (wanted[d] as TimeRange[]).length === 0)) continue;
    const comparable = existing && { ...existing, ...Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, normalise(existing[d])])) };
    if (decide(comparable, wanted, DAYS_OF_WEEK, overwrite, result.unavailability)) unavailabilityRows.push(wanted);
  }

  // ---- swim-test slot bookings and outcomes
  const testPages = await queryAllPages(notion, sourceByKey('swim_tests').dataSourceId);
  const slots = keyed(await db.selectAll('swim_test_slots', 'test_id,slot,member_id,outcome,version'), 'test_id', 'slot');
  const slotRows: Row[] = [];
  for (const page of testPages) {
    const testId = canonicalId(page.id);
    for (const { slot, member_id, outcome } of testSlotValues(page)) {
      const existing = slots.get(`${testId}|${slot}`);
      if (!existing) {
        result.swimTestSlots.unknownRefs++;
        continue;
      }
      const wanted = {
        test_id: testId,
        slot,
        member_id: member(member_id, result.swimTestSlots),
        outcome: outcome && TEST_OUTCOMES.has(outcome) ? outcome : null,
      };
      if (decide(existing, wanted, ['member_id', 'outcome'], overwrite, result.swimTestSlots)) slotRows.push(wanted);
    }
  }

  // ---- marshal sign-ups
  const marshalPages = await queryAllPages(notion, sourceByKey('marshal_slots').dataSourceId);
  const marshals = keyed(await db.selectAll('marshal_slots', 'id,person_id,person_status,version'), 'id');
  const marshalUpdates: Row[] = [];
  for (const page of marshalPages) {
    const id = canonicalId(page.id);
    const existing = marshals.get(id);
    if (!existing) {
      result.marshalSignups.unknownRefs++;
      continue;
    }
    const { person_id, person_status: status } = marshalValues(page);
    const wanted = {
      id,
      person_id: member(person_id, result.marshalSignups),
      person_status: MARSHAL_STATUSES.has(status) ? status : 'Open',
    };
    if (decide(existing, wanted, ['person_id', 'person_status'], overwrite, result.marshalSignups)) {
      marshalUpdates.push(wanted);
    }
  }

  if (options.dryRun) return result;
  await db.upsert('outing_seats', seatRows, 'outing_id,seat');
  await db.upsert('outing_reports', reportRows, 'outing_id');
  await db.upsert('member_unavailability', unavailabilityRows, 'member_id');
  await db.upsert('swim_test_slots', slotRows, 'test_id,slot');
  // marshal_slots has NOT NULL definition columns, so an upsert of just the
  // sign-up columns would fail; update each slot instead (dozens of rows).
  for (const { id, ...values } of marshalUpdates) {
    await db.updateWhere('marshal_slots', { id }, values);
  }
  return result;
}
