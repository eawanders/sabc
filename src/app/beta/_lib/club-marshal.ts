// Marshalling (beta): slot rows, grouping event → day → shift, an optimistic-write reducer and
// toast wording. Pure, so it is shared by the server page, the client and the tests.
import type { LiveConflict, LiveResult } from '@/lib/live/types';
import { dayLabel, londonParts } from './time';

export type MarshalSlot = {
  id: string;
  name: string;
  slot_no: number | null;
  event: string | null;
  day: string | null;
  shift: string | null;
  role: string | null;
  location: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean;
  notes: string | null;
  clash_crews: string[];
  person_id: string | null;
  person_status: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

/** Columns the page reads (anon key: RLS returns published slots only). */
export const MARSHAL_COLUMNS =
  'id, name, slot_no, event, day, shift, role, location, start_at, end_at, all_day, notes, clash_crews, person_id, person_status, version, updated_by, updated_at';

export type ShiftGroup = { key: string; shift: string; slots: MarshalSlot[] };
export type DayGroup = { key: string; label: string; shifts: ShiftGroup[]; total: number; filled: number };
export type EventGroup = { key: string; event: string; days: DayGroup[]; total: number; filled: number };

const time = (s: MarshalSlot) => (s.start_at ? Date.parse(s.start_at) : Number.POSITIVE_INFINITY);

function dayKey(s: MarshalSlot): string {
  if (!s.start_at) return `none:${s.day ?? ''}`;
  const p = londonParts(new Date(s.start_at));
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/**
 * Slots grouped event → London day → shift, each level in time order (an event by its first
 * slot). Within a shift: start time, then slot number, then name.
 */
export function groupSlots(slots: MarshalSlot[]): EventGroup[] {
  const sorted = [...slots].sort(
    (a, b) => time(a) - time(b) || (a.slot_no ?? 1e9) - (b.slot_no ?? 1e9) || a.name.localeCompare(b.name),
  );
  const events = new Map<string, EventGroup>();
  for (const s of sorted) {
    const ev = s.event ?? 'Other';
    let e = events.get(ev);
    if (!e) events.set(ev, (e = { key: ev, event: ev, days: [], total: 0, filled: 0 }));
    const dk = dayKey(s);
    let d = e.days.find((x) => x.key === dk);
    if (!d) {
      d = { key: dk, label: s.start_at ? dayLabel(new Date(s.start_at)) : s.day ?? 'No date', shifts: [], total: 0, filled: 0 };
      e.days.push(d);
    }
    const sh = s.shift ?? '—';
    let g = d.shifts.find((x) => x.shift === sh);
    if (!g) d.shifts.push((g = { key: `${dk}:${sh}`, shift: sh, slots: [] }));
    g.slots.push(s);
    const filled = s.person_id ? 1 : 0;
    e.total++;
    d.total++;
    e.filled += filled;
    d.filled += filled;
  }
  return [...events.values()];
}

// ------------------------------------------------------------------ optimistic state

export type SlotPatch = Pick<MarshalSlot, 'person_id' | 'person_status'>;

export type SlotState = {
  rows: Record<string, MarshalSlot>;
  pending: Record<string, { opId: number; patch: SlotPatch }>;
};

export type SlotAction =
  | { type: 'load'; rows: MarshalSlot[] }
  | { type: 'remote'; row: MarshalSlot } // Realtime / write result: only ever moves a slot forward
  | { type: 'hide'; id: string } // unpublished or deleted
  | { type: 'optimistic'; opId: number; id: string; patch: SlotPatch }
  | { type: 'settled'; opId: number; id: string; row: MarshalSlot | null }
  | { type: 'failed'; opId: number; id: string };

export function initSlots(rows: MarshalSlot[]): SlotState {
  return { rows: Object.fromEntries(rows.map((r) => [r.id, r])), pending: {} };
}

function applyRow(rows: SlotState['rows'], row: MarshalSlot): SlotState['rows'] {
  const cur = rows[row.id];
  if (cur && cur.version > row.version) return rows;
  // Realtime rows carry every column; write results too. Keep anything a partial row leaves out.
  return { ...rows, [row.id]: cur ? { ...cur, ...row } : row };
}

function dropPending(pending: SlotState['pending'], id: string, opId: number): SlotState['pending'] {
  if (pending[id]?.opId !== opId) return pending;
  const next = { ...pending };
  delete next[id];
  return next;
}

export function slotReducer(state: SlotState, action: SlotAction): SlotState {
  switch (action.type) {
    case 'load':
      return initSlots(action.rows);
    case 'remote':
      return { ...state, rows: applyRow(state.rows, action.row) };
    case 'hide': {
      if (!state.rows[action.id]) return state;
      const rows = { ...state.rows };
      delete rows[action.id];
      return { ...state, rows };
    }
    case 'optimistic':
      return { ...state, pending: { ...state.pending, [action.id]: { opId: action.opId, patch: action.patch } } };
    case 'settled':
      return {
        rows: action.row ? applyRow(state.rows, action.row) : state.rows,
        pending: dropPending(state.pending, action.id, action.opId),
      };
    case 'failed':
      return { ...state, pending: dropPending(state.pending, action.id, action.opId) };
  }
}

/** Every visible slot with its optimistic patch on top. */
export function viewSlots(state: SlotState): MarshalSlot[] {
  return Object.values(state.rows).map((r) => (state.pending[r.id] ? { ...r, ...state.pending[r.id].patch } : r));
}

/** What a sign-up / clear looks like before the server answers (the RPC's own rule). */
export function claimPatch(memberId: string | null): SlotPatch {
  return { person_id: memberId, person_status: memberId ? 'Confirmed' : 'Open' };
}

// ------------------------------------------------------------------ wording

export function conflictText(conflict: Pick<LiveConflict<MarshalSlot>, 'current' | 'holderName' | 'updatedByName'>): string {
  if (conflict.current?.person_id) return `${conflict.holderName ?? 'Someone'} took this slot. Yours wasn't applied.`;
  return `${conflict.updatedByName ?? 'Someone'} cleared this slot first. Yours wasn't applied.`;
}

export function slotTitle(s: Pick<MarshalSlot, 'role' | 'shift' | 'location' | 'name'>): string {
  return [s.role, s.shift, s.location].filter(Boolean).join(' · ') || s.name;
}

/** Person status → dot tone (colour for state only). */
export function personTone(s: Pick<MarshalSlot, 'person_id' | 'person_status'>): 'ok' | 'maybe' | 'no' | 'unk' {
  if (!s.person_id) return 'unk';
  switch (s.person_status) {
    case 'Confirmed':
      return 'ok';
    case 'Not Available':
      return 'no';
    case 'Open':
      return 'unk';
    default:
      return 'maybe'; // Reserved, Maybe Available, Awaiting Approval
  }
}

// ------------------------------------------------------------------ one write

export type ClaimOutcome =
  | { kind: 'ok'; changeId: number; row: MarshalSlot }
  | { kind: 'conflict'; text: string }
  | { kind: 'error'; text: string };

/**
 * Sign `memberId` up for `slot` (null clears it): optimistic patch now, the server's answer settles
 * it. First wins: the version sent is the one on screen, so a slot someone else took in the meantime
 * comes back as a conflict, and the row they wrote replaces ours.
 */
export async function performClaim(
  slot: MarshalSlot,
  memberId: string | null,
  actorId: string,
  opId: number,
  dispatch: (a: SlotAction) => void,
  send: (input: { slotId: string; memberId: string | null; actorId: string; expectedVersion: number }) => Promise<
    LiveResult<MarshalSlot>
  >,
): Promise<ClaimOutcome> {
  dispatch({ type: 'optimistic', opId, id: slot.id, patch: claimPatch(memberId) });
  const result = await send({ slotId: slot.id, memberId, actorId, expectedVersion: slot.version });
  if (result.ok) {
    dispatch({ type: 'settled', opId, id: slot.id, row: result.row });
    return { kind: 'ok', changeId: result.changeId, row: result.row };
  }
  if (result.reason === 'conflict') {
    dispatch({ type: 'settled', opId, id: slot.id, row: result.current });
    return { kind: 'conflict', text: conflictText(result) };
  }
  dispatch({ type: 'failed', opId, id: slot.id });
  if (result.reason === 'not_found') return { kind: 'error', text: 'This slot no longer exists.' };
  return { kind: 'error', text: result.message ? `Not saved: ${result.message}` : 'Not saved. Check your connection and try again.' };
}

// ------------------------------------------------------------------ keyboard

export type MarshalKeyIntent =
  | { type: 'focus'; index: number }
  | { type: 'open'; index: number }
  | { type: 'sign-me-up'; index: number }
  | { type: 'pick'; index: number }
  | { type: 'clear'; index: number }
  | { type: 'undo' }
  | { type: 'close' };

/**
 * List keys (no dialog open, focus not in a text field): J/↓ K/↑ move · Enter opens the slot ·
 * S signs you up (empty slot) · A signs someone else up · ⌫ clears (filled slot) · ⌘Z undo · Esc closes.
 */
export function marshalKey(
  input: { key: string; meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean },
  ctx: { focus: number; count: number; filled: (index: number) => boolean },
): MarshalKeyIntent | null {
  const mod = input.meta || input.ctrl;
  if (mod && !input.shift && !input.alt && input.key.toLowerCase() === 'z') return { type: 'undo' };
  if (mod || input.alt) return null;
  if (input.key === 'Escape') return { type: 'close' };
  if (ctx.count === 0) return null;
  const last = ctx.count - 1;
  const i = Math.min(Math.max(ctx.focus, 0), last);
  switch (input.key) {
    case 'j':
    case 'ArrowDown':
      return { type: 'focus', index: ctx.focus < 0 ? 0 : Math.min(last, ctx.focus + 1) };
    case 'k':
    case 'ArrowUp':
      return { type: 'focus', index: Math.max(0, ctx.focus - 1) };
    case 'Enter':
      return ctx.focus < 0 ? null : { type: 'open', index: i };
    case 's':
      return ctx.focus < 0 || ctx.filled(i) ? null : { type: 'sign-me-up', index: i };
    case 'a':
      return ctx.focus < 0 ? null : { type: 'pick', index: i };
    case 'Backspace':
    case 'Delete':
      return ctx.focus >= 0 && ctx.filled(i) ? { type: 'clear', index: i } : null;
    default:
      return null;
  }
}
