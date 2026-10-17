// Seat rows as the server last confirmed them, plus at most one optimistic patch per seat.
// Realtime and write results only ever move a seat forward (higher version), so a late echo
// of an older row can't undo a newer one.
import type { SeatRow } from '@/lib/live/types';

export type SeatPatch = Partial<Pick<SeatRow, 'member_id' | 'status'>>;

export type SeatState = {
  rows: Record<string, SeatRow>;
  pending: Record<string, { opId: number; patch: SeatPatch }>;
};

export type SeatAction =
  | { type: 'load'; rows: SeatRow[] }
  | { type: 'remote'; row: SeatRow }
  | { type: 'optimistic'; opId: number; seat: string; patch: SeatPatch }
  | { type: 'settled'; opId: number; seat: string; rows: SeatRow[] } // ok or conflict: the rows as they are now
  | { type: 'failed'; opId: number; seat: string }; // no answer worth applying: roll back

export const emptySeatState: SeatState = { rows: {}, pending: {} };

function applyRow(rows: Record<string, SeatRow>, row: SeatRow): Record<string, SeatRow> {
  const cur = rows[row.seat];
  if (cur && cur.version > row.version) return rows;
  return { ...rows, [row.seat]: row };
}

function dropPending(pending: SeatState['pending'], seat: string, opId: number): SeatState['pending'] {
  if (pending[seat]?.opId !== opId) return pending;
  const next = { ...pending };
  delete next[seat];
  return next;
}

export function seatReducer(state: SeatState, action: SeatAction): SeatState {
  switch (action.type) {
    case 'load':
      return { rows: Object.fromEntries(action.rows.map((r) => [r.seat, r])), pending: {} };
    case 'remote':
      return { ...state, rows: applyRow(state.rows, action.row) };
    case 'optimistic':
      return { ...state, pending: { ...state.pending, [action.seat]: { opId: action.opId, patch: action.patch } } };
    case 'settled': {
      let rows = state.rows;
      for (const r of action.rows) rows = applyRow(rows, r);
      return { rows, pending: dropPending(state.pending, action.seat, action.opId) };
    }
    case 'failed':
      return { ...state, pending: dropPending(state.pending, action.seat, action.opId) };
  }
}

/** What the drawer shows for a seat: the confirmed row with any optimistic patch on top. */
export function viewSeat(state: SeatState, seat: string): SeatRow | undefined {
  const row = state.rows[seat];
  const p = state.pending[seat];
  if (!row) return undefined;
  return p ? { ...row, ...p.patch } : row;
}

export function isPending(state: SeatState, seat: string): boolean {
  return Boolean(state.pending[seat]);
}
