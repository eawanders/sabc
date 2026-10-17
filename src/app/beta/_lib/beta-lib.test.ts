import { describe, expect, it } from 'vitest';
import { SEAT_PROPERTIES } from '@/lib/seatProperties';
import { toDbSeat } from '@/lib/live/schemas';
import type { SeatRow } from '@/lib/live/types';
import { fitFor, pickerItems } from './availability';
import { drawerKey, pickerKey } from './keyboard';
import { conflictMessage } from './messages';
import { emptySeatState, seatReducer, viewSeat } from './seatState';
import { SEAT_ORDER, seatLabel, seatShort, statusDisplay } from './seats';
import { londonToUtc, mondayOf, weekRange } from './time';

describe('seat names ↔ labels', () => {
  it('labels every database seat, in drawer order', () => {
    expect(SEAT_ORDER.map(seatShort)).toEqual(['BR', 'COX', 'STR', '7', '6', '5', '4', '3', '2', 'BOW', 'S1', 'S2', 'S3', 'S4']);
  });

  it('covers exactly the seats the write API accepts', () => {
    const dbSeats = Object.values(SEAT_PROPERTIES).map((p) => p.relation).sort();
    expect([...SEAT_ORDER].sort()).toEqual(dbSeats);
    for (const s of SEAT_ORDER) expect(toDbSeat(s)).toBe(s);
  });

  it('reads seats in a sentence', () => {
    expect(seatLabel('7 Seat')).toBe('7 seat');
    expect(seatLabel('Coach/Bank Rider')).toBe('Bank rider');
    expect(seatLabel('Sub 2')).toBe('Sub 2');
  });

  it('maps statuses to a tone and a short word', () => {
    expect(statusDisplay('Available')).toEqual({ tone: 'ok', text: 'Available' });
    expect(statusDisplay('Maybe Available')).toEqual({ tone: 'maybe', text: 'Maybe' });
    expect(statusDisplay('Not Available')).toEqual({ tone: 'no', text: "Can't" });
    expect(statusDisplay('Awaiting Approval')).toEqual({ tone: 'unk', text: 'Awaiting' });
    expect(statusDisplay(null).tone).toBe('unk');
  });
});

describe('London time', () => {
  it('converts wall-clock times across BST and GMT', () => {
    expect(londonToUtc(2026, 10, 19, 7, 0).toISOString()).toBe('2026-10-19T06:00:00.000Z'); // BST
    expect(londonToUtc(2026, 11, 2, 7, 0).toISOString()).toBe('2026-11-02T07:00:00.000Z'); // GMT
  });

  it('finds the London Monday, even late on Sunday UTC', () => {
    expect(mondayOf(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-19'); // still Sun 25 Oct in London (GMT)
    expect(mondayOf(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19'); // Mon 00:30 BST
  });

  it('spans a week that crosses the clock change', () => {
    const { start, end } = weekRange('2026-10-19');
    expect(start.toISOString()).toBe('2026-10-18T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });
});

describe('picker grouping', () => {
  // Mon 19 Oct 2026, 07:00–08:30 London (BST)
  const start = new Date('2026-10-19T06:00:00Z');
  const end = new Date('2026-10-19T07:30:00Z');

  it('classifies free, maybe and unavailable on the outing weekday in London time', () => {
    expect(fitFor(undefined, start, end)).toBe('free');
    expect(fitFor({ monday: [] }, start, end)).toBe('free');
    expect(fitFor({ monday: [{ start: '09:00', end: '12:00' }] }, start, end)).toBe('free');
    expect(fitFor({ monday: [{ start: '08:30', end: '12:00' }] }, start, end)).toBe('free'); // touches the end only
    expect(fitFor({ monday: [{ start: '08:00', end: '12:00' }] }, start, end)).toBe('maybe');
    expect(fitFor({ monday: [{ start: '06:00', end: '09:00' }] }, start, end)).toBe('unavailable');
    expect(fitFor({ monday: [{ start: '06:00', end: '07:45' }, { start: '07:45', end: '09:00' }] }, start, end)).toBe('unavailable');
    expect(fitFor({ tuesday: [{ start: '00:00', end: '23:59' }] }, start, end)).toBe('free'); // another day
  });

  it('uses the London weekday, not the UTC one', () => {
    // Tue 20 Oct 00:30 BST is Mon 23:30 UTC
    const late = new Date('2026-10-19T23:30:00Z');
    expect(fitFor({ tuesday: [{ start: '00:00', end: '01:00' }] }, late, null)).toBe('unavailable');
    expect(fitFor({ monday: [{ start: '23:00', end: '23:59' }] }, late, null)).toBe('free');
  });

  it('groups, filters and marks members already seated', () => {
    const members = [
      { id: 'a', name: 'Ada' },
      { id: 'b', name: 'Ben' },
      { id: 'c', name: 'Cora' },
      { id: 'd', name: 'Dev' },
    ];
    const unavailability = {
      b: { monday: [{ start: '08:00', end: '10:00' }] },
      c: { monday: [{ start: '00:00', end: '23:00' }] },
    };
    const items = pickerItems({ members, unavailability, start, end, query: '', seatedIn: { d: 'Bow' }, canClear: true });
    expect(items.map((i) => (i.kind === 'member' ? i.member.id : i.kind === 'group' ? `#${i.title}` : i.kind))).toEqual([
      'clear',
      '#Free Mon 07:00',
      'a',
      'd',
      '#Maybe free',
      'b',
      '#Unavailable',
      'c',
    ]);
    expect(items.find((i) => i.kind === 'member' && i.member.id === 'd')).toMatchObject({ seatedIn: 'Bow' });

    const filtered = pickerItems({ members, unavailability, start, end, query: 'co', seatedIn: {}, canClear: true });
    expect(filtered.map((i) => i.kind)).toEqual(['group', 'member']); // no "Clear seat" while searching
  });
});

describe('drawer keyboard', () => {
  const ctx = { focus: 2, count: 14, filled: (i: number) => i !== 5 };

  it('moves focus with J/K and the arrows, clamped to the list', () => {
    expect(drawerKey({ key: 'j' }, ctx)).toEqual({ type: 'focus', index: 3 });
    expect(drawerKey({ key: 'ArrowDown' }, ctx)).toEqual({ type: 'focus', index: 3 });
    expect(drawerKey({ key: 'k' }, ctx)).toEqual({ type: 'focus', index: 1 });
    expect(drawerKey({ key: 'ArrowUp' }, { ...ctx, focus: 0 })).toEqual({ type: 'focus', index: 0 });
    expect(drawerKey({ key: 'j' }, { ...ctx, focus: 13 })).toEqual({ type: 'focus', index: 13 });
  });

  it('maps Enter, 1/2/3, Backspace, ⌘Z and Esc', () => {
    expect(drawerKey({ key: 'Enter' }, ctx)).toEqual({ type: 'open-picker', index: 2 });
    expect(drawerKey({ key: '1' }, ctx)).toEqual({ type: 'set-status', index: 2, status: 'Available' });
    expect(drawerKey({ key: '2' }, ctx)).toEqual({ type: 'set-status', index: 2, status: 'Maybe Available' });
    expect(drawerKey({ key: '3' }, ctx)).toEqual({ type: 'set-status', index: 2, status: 'Not Available' });
    expect(drawerKey({ key: 'Backspace' }, ctx)).toEqual({ type: 'clear', index: 2 });
    expect(drawerKey({ key: 'z', meta: true }, ctx)).toEqual({ type: 'undo' });
    expect(drawerKey({ key: 'Z', ctrl: true }, ctx)).toEqual({ type: 'undo' });
    expect(drawerKey({ key: 'Escape' }, ctx)).toEqual({ type: 'close' });
  });

  it('ignores status and clear keys on an empty seat, and unrelated keys', () => {
    const empty = { ...ctx, focus: 5 };
    expect(drawerKey({ key: '1' }, empty)).toBeNull();
    expect(drawerKey({ key: 'Backspace' }, empty)).toBeNull();
    expect(drawerKey({ key: 'x' }, ctx)).toBeNull();
    expect(drawerKey({ key: 'j', meta: true }, ctx)).toBeNull();
    expect(drawerKey({ key: 'z', meta: true, shift: true }, ctx)).toBeNull();
  });

  it('moves and chooses in the palette', () => {
    expect(pickerKey('ArrowDown', { index: 0, count: 3 })).toEqual({ type: 'move', index: 1 });
    expect(pickerKey('ArrowDown', { index: 2, count: 3 })).toEqual({ type: 'move', index: 2 });
    expect(pickerKey('ArrowUp', { index: 0, count: 3 })).toEqual({ type: 'move', index: 0 });
    expect(pickerKey('Enter', { index: 1, count: 3 })).toEqual({ type: 'choose', index: 1 });
    expect(pickerKey('Enter', { index: 0, count: 0 })).toBeNull();
    expect(pickerKey('Escape', { index: 0, count: 3 })).toEqual({ type: 'close' });
  });
});

describe('optimistic seats', () => {
  const row = (seat: string, member_id: string | null, version: number, status: string | null = 'Available'): SeatRow => ({
    outing_id: 'o',
    seat,
    member_id,
    status,
    version,
    updated_by: null,
    updated_at: '2026-10-17T00:00:00Z',
  });
  const loaded = seatReducer(emptySeatState, { type: 'load', rows: [row('Bow', null, 3), row('Stroke', 'a', 1)] });

  it('shows the patch at once and keeps it until the write settles', () => {
    const s = seatReducer(loaded, { type: 'optimistic', opId: 1, seat: 'Bow', patch: { member_id: 'me', status: 'Awaiting Approval' } });
    expect(viewSeat(s, 'Bow')).toMatchObject({ member_id: 'me', status: 'Awaiting Approval', version: 3 });
    const ok = seatReducer(s, { type: 'settled', opId: 1, seat: 'Bow', rows: [row('Bow', 'me', 4, 'Awaiting Approval')] });
    expect(ok.pending).toEqual({});
    expect(viewSeat(ok, 'Bow')).toMatchObject({ member_id: 'me', version: 4 });
  });

  it('rolls back to the winner on a conflict', () => {
    const s = seatReducer(loaded, { type: 'optimistic', opId: 2, seat: 'Bow', patch: { member_id: 'me' } });
    const lost = seatReducer(s, { type: 'settled', opId: 2, seat: 'Bow', rows: [row('Bow', 'sam', 4)] });
    expect(viewSeat(lost, 'Bow')).toMatchObject({ member_id: 'sam', version: 4 });
  });

  it('rolls back to the confirmed row when the write fails', () => {
    const s = seatReducer(loaded, { type: 'optimistic', opId: 3, seat: 'Stroke', patch: { status: 'Not Available' } });
    const failed = seatReducer(s, { type: 'failed', opId: 3, seat: 'Stroke' });
    expect(viewSeat(failed, 'Stroke')).toMatchObject({ member_id: 'a', status: 'Available' });
  });

  it('keeps an in-flight patch on top of a Realtime change, and ignores stale rows', () => {
    const s = seatReducer(loaded, { type: 'optimistic', opId: 4, seat: 'Bow', patch: { member_id: 'me' } });
    const remote = seatReducer(s, { type: 'remote', row: row('Bow', 'sam', 4) });
    expect(viewSeat(remote, 'Bow')).toMatchObject({ member_id: 'me' }); // still ours until it settles
    expect(remote.rows.Bow.member_id).toBe('sam');
    const stale = seatReducer(remote, { type: 'remote', row: row('Bow', null, 3) });
    expect(stale.rows.Bow.version).toBe(4);
  });

  it("does not let an older op's result clear a newer op's patch", () => {
    let s = seatReducer(loaded, { type: 'optimistic', opId: 5, seat: 'Bow', patch: { member_id: 'x' } });
    s = seatReducer(s, { type: 'optimistic', opId: 6, seat: 'Bow', patch: { member_id: 'y' } });
    s = seatReducer(s, { type: 'failed', opId: 5, seat: 'Bow' });
    expect(viewSeat(s, 'Bow')).toMatchObject({ member_id: 'y' });
  });
});

describe('conflict toast', () => {
  it('names who changed the seat first and who holds it now', () => {
    expect(conflictMessage('Stroke', { holderName: 'Sam Okafor', updatedByName: 'Sam Okafor' })).toBe(
      "Sam Okafor changed Stroke first (now Sam Okafor). Yours wasn't applied.",
    );
    expect(conflictMessage('7 Seat', { holderName: null, updatedByName: 'Jo' })).toBe(
      "Jo changed 7 seat first (now empty). Yours wasn't applied.",
    );
    expect(conflictMessage('Bow', { holderName: 'Ada', updatedByName: 'Ben', heldSeat: '3 Seat' })).toBe(
      "Ada is already in 3 seat. Yours wasn't applied.",
    );
  });
});
