// "My week": the signed-in member's seats across several outings. Each outing keeps its seats in
// the same optimistic seat state the crew drawer uses (seatState.ts), so Realtime echoes, write
// results and rollbacks behave identically; this file only adds the outing layer on top.
import type { SeatRow } from '@/lib/live/types';
import { emptySeatState, isPending, seatReducer, viewSeat, type SeatAction, type SeatState } from './seatState';
import { CREW_SEATS, SEAT_ORDER } from './seats';

export type MyOuting = {
  id: string;
  name: string;
  type: string | null;
  div: string | null;
  shell: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
};

export type MineState = {
  outings: Record<string, MyOuting>;
  seats: Record<string, SeatState>;
};

export type MineAction =
  | { type: 'load'; outings: MyOuting[]; rows: SeatRow[] }
  | { type: 'outing'; outing: Partial<MyOuting> & { id: string } }
  | { type: 'seat'; outingId: string; action: SeatAction };

export const emptyMine: MineState = { outings: {}, seats: {} };

export function mineReducer(state: MineState, action: MineAction): MineState {
  switch (action.type) {
    case 'load': {
      const byOuting: Record<string, SeatRow[]> = {};
      for (const r of action.rows) (byOuting[r.outing_id] ??= []).push(r);
      return {
        outings: Object.fromEntries(action.outings.map((o) => [o.id, o])),
        seats: Object.fromEntries(
          action.outings.map((o) => {
            const loaded = seatReducer(emptySeatState, { type: 'load', rows: byOuting[o.id] ?? [] });
            // A reload (tab back in view, Realtime catch-up) must not drop a reply still in flight
            return [o.id, { ...loaded, pending: state.seats[o.id]?.pending ?? {} }];
          }),
        ),
      };
    }
    case 'outing': {
      const cur = state.outings[action.outing.id];
      if (!cur) return state;
      return { ...state, outings: { ...state.outings, [cur.id]: { ...cur, ...action.outing } } };
    }
    case 'seat': {
      const cur = state.seats[action.outingId];
      if (!cur) return state; // not one of ours (yet): the caller reloads
      return { ...state, seats: { ...state.seats, [action.outingId]: seatReducer(cur, action.action) } };
    }
  }
}

export type MyRow = {
  key: string; // `${outingId}|${seat}`
  outing: MyOuting;
  seat: string;
  row: SeatRow; // with any optimistic patch applied
  pending: boolean;
  crewFilled: number;
};

/** One row per seat `memberId` holds, ordered by start time, then drawer seat order. */
export function myRows(state: MineState, memberId: string | null): MyRow[] {
  if (!memberId) return [];
  const outings = Object.values(state.outings)
    .filter((o) => o.start_at)
    .sort((a, b) => a.start_at!.localeCompare(b.start_at!) || a.name.localeCompare(b.name));
  const rows: MyRow[] = [];
  for (const outing of outings) {
    const seats = state.seats[outing.id];
    if (!seats) continue;
    const crewFilled = CREW_SEATS.filter((s) => viewSeat(seats, s)?.member_id).length;
    for (const seat of SEAT_ORDER) {
      const row = viewSeat(seats, seat);
      if (row?.member_id !== memberId) continue;
      rows.push({ key: `${outing.id}|${seat}`, outing, seat, row, pending: isPending(seats, seat), crewFilled });
    }
  }
  return rows;
}

/** The three replies a member can give for their own seat, in control order. */
export const REPLIES = [
  { status: 'Available', label: 'Available', tone: 'ok' },
  { status: 'Maybe Available', label: 'Maybe', tone: 'maybe' },
  { status: 'Not Available', label: "Can't", tone: 'no' },
] as const;

/** Realtime filter for a set of outings, e.g. `outing_id=in.(a,b)`; null when there are none. */
export function inFilter(column: string, ids: string[]): string | null {
  if (ids.length === 0) return null;
  return `${column}=in.(${[...ids].sort().join(',')})`;
}
