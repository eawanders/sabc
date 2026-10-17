// Swim-test slot rows as the server last confirmed them, plus at most one optimistic patch per slot
// (the same model as seatState.ts). Rows only move forward (higher version), so a late Realtime
// echo of an older row can't undo a newer one.
import type { LiveResult, TestSlotRow } from '@/lib/live/types';

export const MAX_SLOTS = 6;
export const OUTCOMES = ['Test Booked', 'Passed', 'Failed', 'No Show'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type SlotPatch = Partial<Pick<TestSlotRow, 'member_id' | 'outcome'>>;

export type SlotState = {
  rows: Record<string, TestSlotRow>;
  pending: Record<string, { opId: number; patch: SlotPatch }>;
};

export type SlotAction =
  | { type: 'merge'; rows: TestSlotRow[] } // initial load, reloads and Realtime
  | { type: 'optimistic'; opId: number; key: string; patch: SlotPatch }
  | { type: 'settled'; opId: number; key: string; rows: TestSlotRow[] } // ok or conflict: the row as it is now
  | { type: 'failed'; opId: number; key: string }; // nothing worth applying: roll back

export const emptySlotState: SlotState = { rows: {}, pending: {} };

export function slotKey(testId: string, slot: number): string {
  return `${testId}#${slot}`;
}

function applyRows(rows: Record<string, TestSlotRow>, incoming: TestSlotRow[]): Record<string, TestSlotRow> {
  let next = rows;
  for (const row of incoming) {
    const key = slotKey(row.test_id, row.slot);
    const cur = next[key];
    if (cur && cur.version > row.version) continue;
    if (cur === row) continue;
    if (next === rows) next = { ...rows };
    next[key] = row;
  }
  return next;
}

function dropPending(pending: SlotState['pending'], key: string, opId: number): SlotState['pending'] {
  if (pending[key]?.opId !== opId) return pending;
  const next = { ...pending };
  delete next[key];
  return next;
}

export function slotReducer(state: SlotState, action: SlotAction): SlotState {
  switch (action.type) {
    case 'merge': {
      const rows = applyRows(state.rows, action.rows);
      return rows === state.rows ? state : { ...state, rows };
    }
    case 'optimistic':
      return { ...state, pending: { ...state.pending, [action.key]: { opId: action.opId, patch: action.patch } } };
    case 'settled':
      return { rows: applyRows(state.rows, action.rows), pending: dropPending(state.pending, action.key, action.opId) };
    case 'failed':
      return { ...state, pending: dropPending(state.pending, action.key, action.opId) };
  }
}

/** What the page shows for a slot: the confirmed row with any optimistic patch on top. */
export function viewSlot(state: SlotState, testId: string, slot: number): TestSlotRow | undefined {
  const key = slotKey(testId, slot);
  const row = state.rows[key];
  if (!row) return undefined;
  const p = state.pending[key];
  return p ? { ...row, ...p.patch } : row;
}

type TestShape = { id: string; available_slots: number };

/**
 * Slot numbers the drawer lists: 1..available_slots, extended to any higher slot that still has
 * someone in it (Notion's "Available Slots" can be lowered after people booked).
 */
export function shownSlots(state: SlotState, test: TestShape): number[] {
  let n = Math.min(MAX_SLOTS, Math.max(0, test.available_slots));
  for (let s = MAX_SLOTS; s > n; s--) {
    if (viewSlot(state, test.id, s)?.member_id) {
      n = s;
      break;
    }
  }
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Booked slots (with someone in them) and the capacity, for "n/available". */
export function bookedCount(state: SlotState, test: TestShape): { booked: number; capacity: number } {
  const booked = shownSlots(state, test).filter((s) => viewSlot(state, test.id, s)?.member_id).length;
  return { booked, capacity: Math.max(0, Math.min(MAX_SLOTS, test.available_slots)) };
}

/** The slot `memberId` holds in this test, if any. */
export function slotOf(state: SlotState, test: TestShape, memberId: string | null): number | null {
  if (!memberId) return null;
  return shownSlots(state, test).find((s) => viewSlot(state, test.id, s)?.member_id === memberId) ?? null;
}

/** member id → slot number, for everyone booked in this test. */
export function bookedIn(state: SlotState, test: TestShape): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of shownSlots(state, test)) {
    const m = viewSlot(state, test.id, s)?.member_id;
    if (m) out[m] = s;
  }
  return out;
}

export type BookingOutcome =
  | { kind: 'booked'; slot: number; result: Extract<LiveResult<TestSlotRow>, { ok: true }>; lost: Lost[] }
  | { kind: 'already'; slot: number }
  | { kind: 'full'; lost: Lost[] }
  | { kind: 'failed'; result: Exclude<LiveResult<TestSlotRow>, { ok: true }>; lost: Lost[] };

export type Lost = { slot: number; holderName: string | null };

/**
 * "Book me": claim the lowest free slot; if someone takes it first, try the next free one, so a
 * sign-up rush still lands you in a slot when there is one. `row(slot)` is the slot as on screen;
 * `claim` sends one first-wins claim with the version seen. Conflicts are remembered locally, so
 * a slot lost here isn't tried again before Realtime catches up.
 */
export async function bookFirstFree(opts: {
  available: number;
  me: string;
  row: (slot: number) => TestSlotRow | undefined;
  busy: (slot: number) => boolean; // a write of ours is already in flight on it
  claim: (slot: number, expectedVersion: number) => Promise<LiveResult<TestSlotRow>>;
}): Promise<BookingOutcome> {
  const capacity = Math.min(MAX_SLOTS, Math.max(0, opts.available));
  const seen = new Map<number, TestSlotRow>();
  const current = (s: number) => seen.get(s) ?? opts.row(s);
  const lost: Lost[] = [];

  for (let s = 1; s <= MAX_SLOTS; s++) {
    if (current(s)?.member_id === opts.me) return { kind: 'already', slot: s };
  }
  for (let attempt = 0; attempt < MAX_SLOTS; attempt++) {
    let slot = 0;
    for (let s = 1; s <= capacity; s++) {
      const r = current(s);
      if (r && !r.member_id && !opts.busy(s)) {
        slot = s;
        break;
      }
    }
    if (!slot) return { kind: 'full', lost };
    const result = await opts.claim(slot, current(slot)!.version);
    if (result.ok) return { kind: 'booked', slot, result, lost };
    if (result.reason !== 'conflict' || !result.current) return { kind: 'failed', result, lost };
    seen.set(slot, result.current);
    if (result.current.member_id === opts.me) return { kind: 'already', slot }; // booked from another tab
    if (result.current.member_id) lost.push({ slot, holderName: result.holderName });
  }
  return { kind: 'full', lost };
}
