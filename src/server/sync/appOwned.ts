// Notion -> Postgres values for the APP-OWNED fields (seats, reports, weekly
// unavailability, swim-test slots, marshal sign-ups). Shared by the one-off
// backfill and by the inbound sync's per-field reconcile, which hands them to
// the sync_reconcile_* SQL functions (supabase/migrations/20261018600100_*).
// Values are raw: member ids are canonicalised but not checked against
// members, and option names are not validated; the SQL side (or the backfill)
// decides what to do with unknown ones.
import { SEAT_PROPERTIES } from '@/lib/seatProperties';
import { DAYS_OF_WEEK, DAY_LABELS, parseTimeRanges, type DayOfWeek, type TimeRange } from '@/types/rowerAvailability';
import type { ReconcileKind, ReconcileResult, SyncDb } from './db';
import { optionName, plainText, relationIds } from './notionValues';
import { canonicalId, isTrashed, type NotionPage, type SourceDef } from './sources';

export const REPORT_FIELDS: Record<string, string> = {
  outing_summary: 'Outing Summary',
  boat_feel: 'Boat Feel',
  outing_successes: 'Outing Successes',
  next_focus: 'Next Focus',
  coach_feedback: 'Coach Feedback',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const props = (page: NotionPage) => (page.properties ?? {}) as Record<string, any>;

/** First member of a relation (the app only ever holds one), canonical id or null. */
export function firstMember(prop: unknown): string | null {
  const id = relationIds(prop)[0];
  return id ? canonicalId(id) : null;
}

export function seatValues(page: NotionPage) {
  const p = props(page);
  return Object.values(SEAT_PROPERTIES).map(({ relation, status }) => ({
    seat: relation,
    member_id: firstMember(p[relation]),
    status: optionName(p[status]),
  }));
}

export function reportValues(page: NotionPage): Record<string, string | null> {
  const p = props(page);
  return Object.fromEntries(Object.entries(REPORT_FIELDS).map(([col, prop]) => [col, plainText(p[prop])]));
}

/** The seven "Unavailable <Day>" JSON text fields, parsed as the current app does. */
export function unavailabilityValues(page: NotionPage): Record<DayOfWeek, TimeRange[]> {
  const p = props(page);
  return Object.fromEntries(
    DAYS_OF_WEEK.map((day) => [
      day,
      parseTimeRanges(plainText(p[`Unavailable ${DAY_LABELS[day]}`])).map((r) => ({ start: r.start, end: r.end })),
    ]),
  ) as Record<DayOfWeek, TimeRange[]>;
}

export function testSlotValues(page: NotionPage) {
  const p = props(page);
  return [1, 2, 3, 4, 5, 6].map((slot) => ({
    slot,
    member_id: firstMember(p[`Slot ${slot}`]),
    outcome: optionName(p[`Slot ${slot} Outcome`]),
  }));
}

export function marshalValues(page: NotionPage) {
  const p = props(page);
  return {
    person_id: firstMember(p['Person']),
    // An empty Notion select means nobody has signed up; the column is NOT NULL.
    person_status: optionName(p['Person Status']) ?? 'Open',
  };
}

/** The reconcile calls one inbound page of results needs, per data source. */
export function reconcileCalls(source: SourceDef, pages: NotionPage[]): { kind: ReconcileKind; items: Record<string, unknown>[] }[] {
  const live = pages.filter((page) => !isTrashed(page));
  if (live.length === 0) return [];
  const base = (page: NotionPage) => ({ edited_at: page.last_edited_time ?? null });
  switch (source.key) {
    case 'outings':
      return [
        { kind: 'seats', items: live.map((page) => ({ outing_id: canonicalId(page.id), ...base(page), seats: seatValues(page) })) },
        { kind: 'reports', items: live.map((page) => ({ outing_id: canonicalId(page.id), ...base(page), fields: reportValues(page) })) },
      ];
    case 'members':
      return [
        {
          kind: 'unavailability',
          items: live.map((page) => ({ member_id: canonicalId(page.id), ...base(page), days: unavailabilityValues(page) })),
        },
      ];
    case 'swim_tests':
      return [{ kind: 'test_slots', items: live.map((page) => ({ test_id: canonicalId(page.id), ...base(page), slots: testSlotValues(page) })) }];
    case 'marshal_slots':
      return [{ kind: 'marshal_slots', items: live.map((page) => ({ id: canonicalId(page.id), ...base(page), ...marshalValues(page) })) }];
    default:
      return [];
  }
}

export interface AppOwnedTally {
  rows: number;
  keptPending: number;
  keptNewer: number;
  skipped: number;
}

export const emptyTally = (): AppOwnedTally => ({ rows: 0, keptPending: 0, keptNewer: 0, skipped: 0 });

/**
 * Reconciles the app-owned fields of these pages from Notion (per-field rule in
 * the SQL functions). Fields kept because the app's write is newer than the
 * Notion edit, and skipped pages, are logged as warnings.
 */
export async function reconcileAppOwned(db: SyncDb, source: SourceDef, pages: NotionPage[], tally: AppOwnedTally) {
  for (const { kind, items } of reconcileCalls(source, pages)) {
    const res: ReconcileResult = await db.reconcileAppOwned(kind, items);
    tally.rows += res.rows;
    tally.keptPending += res.kept_pending;
    tally.keptNewer += res.kept_newer.length;
    tally.skipped += res.skipped.length;
    if (res.kept_newer.length) {
      console.warn(`[sync] ${kind}: kept app values newer than Notion`, JSON.stringify(res.kept_newer));
    }
    if (res.skipped.length) {
      console.warn(`[sync] ${kind}: skipped`, JSON.stringify(res.skipped));
    }
  }
}
