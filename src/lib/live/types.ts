// src/lib/live/types.ts
// Shapes shared by the /api/live/* routes and their browser callers (PER-276).
// Rows are the database rows as they are (snake_case), the same shape Realtime delivers.

export type SeatRow = {
  outing_id: string;
  seat: string; // Notion relation name: 'Bow', 'Sub 1', 'Coach/Bank Rider', ...
  member_id: string | null;
  status: string | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

export type TestSlotRow = {
  test_id: string;
  slot: number;
  member_id: string | null;
  outcome: string | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

export type MarshalSlotRow = {
  id: string;
  person_id: string | null;
  person_status: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  [definition: string]: unknown; // name, event, day, shift, ... (synced from Notion)
};

export type TimeRangeRow = { start: string; end: string };

export type UnavailabilityRow = {
  member_id: string;
  monday: TimeRangeRow[];
  tuesday: TimeRangeRow[];
  wednesday: TimeRangeRow[];
  thursday: TimeRangeRow[];
  friday: TimeRangeRow[];
  saturday: TimeRangeRow[];
  sunday: TimeRangeRow[];
  version: number;
  updated_by: string | null;
  updated_at: string;
};

export type OutingReportRow = {
  outing_id: string;
  outing_summary: string | null;
  boat_feel: string | null;
  outing_successes: string | null;
  next_focus: string | null;
  coach_feedback: string | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

export type OutingStatusChange = { from: string | null; to: 'Confirmed' | 'Provisional' };

/** The write happened. `changeId` is what one-tap undo sends back. */
export type LiveOk<Row> = {
  ok: true;
  changeId: number;
  row: Row;
  rows?: Row[]; // both seats, for a swap
  outingStatus: OutingStatusChange | null; // set when the write auto-(de)confirmed the outing
};

/** Someone got there first: nothing was written. `current` is the row now. */
export type LiveConflict<Row> = {
  ok: false;
  reason: 'conflict';
  current: Row | null;
  holderName: string | null; // who holds the seat / slot now
  updatedByName: string | null; // who last changed it
  heldSeat?: string; // the member already sits here in this outing
  heldSlot?: number; // the member already holds this slot of the swim test
  message?: string;
};

export type LiveFailure = {
  ok: false;
  reason: 'invalid' | 'not_found' | 'forbidden' | 'rate_limited' | 'error';
  message?: string;
};

export type LiveResult<Row> = LiveOk<Row> | LiveConflict<Row> | LiveFailure;

export type LiveReason = LiveConflict<unknown>['reason'] | LiveFailure['reason'];
