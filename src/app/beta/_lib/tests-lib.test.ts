import { describe, expect, it, vi } from 'vitest';
import type { LiveResult, TestSlotRow } from '@/lib/live/types';
import { matchesType, parseType, parseWhen, startOfLondonDay, typeLabel } from './tests-data';
import { testDrawerKey } from './tests-keyboard';
import { bookedMessage, fullMessage, outcomeConflictMessage, slotChangeMessage, takenMessage } from './tests-messages';
import {
  bookFirstFree,
  bookedCount,
  bookedIn,
  emptySlotState,
  shownSlots,
  slotKey,
  slotOf,
  slotReducer,
  viewSlot,
  type SlotState,
} from './tests-state';
import { testInfo } from './tests-info';
import { slotPickerItems } from './tests-picker';

const T = 'test-1';
const ME = 'me';
const row = (slot: number, member_id: string | null = null, version = 0, outcome: string | null = null): TestSlotRow => ({
  test_id: T,
  slot,
  member_id,
  outcome,
  version,
  updated_by: null,
  updated_at: '2026-10-18T00:00:00Z',
});
const stateOf = (rows: TestSlotRow[]): SlotState => slotReducer(emptySlotState, { type: 'merge', rows });
const six = (fill: Record<number, string> = {}) => [1, 2, 3, 4, 5, 6].map((s) => row(s, fill[s] ?? null));

describe('slotReducer', () => {
  it('only moves rows forward, so a late echo of an older version is ignored', () => {
    let s = stateOf([row(1, 'a', 3)]);
    s = slotReducer(s, { type: 'merge', rows: [row(1, null, 2)] });
    expect(viewSlot(s, T, 1)?.member_id).toBe('a');
    s = slotReducer(s, { type: 'merge', rows: [row(1, 'b', 4)] });
    expect(viewSlot(s, T, 1)?.member_id).toBe('b');
  });

  it('shows an optimistic patch until it settles, and rolls it back on failure', () => {
    let s = stateOf([row(1, null, 0)]);
    s = slotReducer(s, { type: 'optimistic', opId: 1, key: slotKey(T, 1), patch: { member_id: ME, outcome: 'Test Booked' } });
    expect(viewSlot(s, T, 1)).toMatchObject({ member_id: ME, outcome: 'Test Booked', version: 0 });
    const failed = slotReducer(s, { type: 'failed', opId: 1, key: slotKey(T, 1) });
    expect(viewSlot(failed, T, 1)?.member_id).toBeNull();
    const settled = slotReducer(s, { type: 'settled', opId: 1, key: slotKey(T, 1), rows: [row(1, 'other', 1)] });
    expect(viewSlot(settled, T, 1)?.member_id).toBe('other'); // a conflict settles to the winner
    expect(settled.pending).toEqual({});
  });

  it('a stale op does not drop a newer pending patch', () => {
    let s = stateOf([row(1)]);
    s = slotReducer(s, { type: 'optimistic', opId: 2, key: slotKey(T, 1), patch: { outcome: 'Passed' } });
    s = slotReducer(s, { type: 'failed', opId: 1, key: slotKey(T, 1) });
    expect(viewSlot(s, T, 1)?.outcome).toBe('Passed');
  });
});

describe('slot helpers', () => {
  const test = { id: T, available_slots: 3 };

  it('lists available slots, extended to a higher slot someone still holds', () => {
    expect(shownSlots(stateOf(six()), test)).toEqual([1, 2, 3]);
    expect(shownSlots(stateOf(six({ 5: 'x' })), test)).toEqual([1, 2, 3, 4, 5]);
    expect(shownSlots(stateOf(six()), { id: T, available_slots: 0 })).toEqual([]);
    expect(shownSlots(stateOf(six()), { id: T, available_slots: 9 })).toHaveLength(6);
  });

  it('counts bookings against capacity and finds members', () => {
    const s = stateOf(six({ 1: 'a', 3: ME }));
    expect(bookedCount(s, test)).toEqual({ booked: 2, capacity: 3 });
    expect(slotOf(s, test, ME)).toBe(3);
    expect(slotOf(s, test, 'nobody')).toBeNull();
    expect(slotOf(s, test, null)).toBeNull();
    expect(bookedIn(s, test)).toEqual({ a: 1, [ME]: 3 });
  });
});

describe('bookFirstFree (Book me)', () => {
  const ok = (r: TestSlotRow): LiveResult<TestSlotRow> => ({ ok: true, changeId: 9, row: r, outingStatus: null });
  const conflict = (r: TestSlotRow, holderName: string | null): LiveResult<TestSlotRow> => ({
    ok: false,
    reason: 'conflict',
    current: r,
    holderName,
    updatedByName: holderName,
  });

  it('claims the lowest free slot with the version on screen', async () => {
    const s = stateOf([row(1, 'a', 4), row(2, null, 7), row(3)]);
    const claim = vi.fn(async (slot: number) => ok(row(slot, ME, 8)));
    const out = await bookFirstFree({ available: 3, me: ME, row: (n) => viewSlot(s, T, n), busy: () => false, claim });
    expect(claim).toHaveBeenCalledExactlyOnceWith(2, 7);
    expect(out).toMatchObject({ kind: 'booked', slot: 2, lost: [] });
  });

  it('on losing a race moves on to the next free slot and reports who won', async () => {
    const s = stateOf(six());
    const claim = vi.fn(async (slot: number) => (slot === 1 ? conflict(row(1, 'ben', 1), 'Ben') : ok(row(slot, ME, 1))));
    const out = await bookFirstFree({ available: 2, me: ME, row: (n) => viewSlot(s, T, n), busy: () => false, claim });
    expect(claim.mock.calls.map((c) => c[0])).toEqual([1, 2]);
    expect(out).toMatchObject({ kind: 'booked', slot: 2, lost: [{ slot: 1, holderName: 'Ben' }] });
    expect(bookedMessage(2, [{ slot: 1, holderName: 'Ben' }])).toBe('Booked you in Slot 2 (Slot 1 went to Ben first)');
  });

  it('retries the same slot with the new version when it changed but is still empty', async () => {
    const s = stateOf([row(1, null, 0)]);
    const claim = vi
      .fn<(slot: number, v: number) => Promise<LiveResult<TestSlotRow>>>()
      .mockResolvedValueOnce(conflict(row(1, null, 2), null))
      .mockResolvedValueOnce(ok(row(1, ME, 3)));
    const out = await bookFirstFree({ available: 1, me: ME, row: (n) => viewSlot(s, T, n), busy: () => false, claim });
    expect(claim.mock.calls).toEqual([[1, 0], [1, 2]]);
    expect(out.kind).toBe('booked');
  });

  it('is full when every slot is taken (including ones lost on the way)', async () => {
    const s = stateOf([row(1), row(2, 'a')]);
    const claim = vi.fn(async () => conflict(row(1, 'cy', 1), 'Cy'));
    const out = await bookFirstFree({ available: 2, me: ME, row: (n) => viewSlot(s, T, n), busy: () => false, claim });
    expect(out).toEqual({ kind: 'full', lost: [{ slot: 1, holderName: 'Cy' }] });
    expect(fullMessage([{ slot: 1, holderName: 'Cy' }])).toBe('Full: Cy took the last slot first.');
    expect(fullMessage([])).toBe('Full: no free slots left.');
  });

  it("doesn't book twice: already in a slot (or one of ours in flight shows us there)", async () => {
    const s = stateOf(six({ 4: ME }));
    const claim = vi.fn();
    expect(await bookFirstFree({ available: 6, me: ME, row: (n) => viewSlot(s, T, n), busy: () => false, claim })).toEqual({
      kind: 'already',
      slot: 4,
    });
    expect(claim).not.toHaveBeenCalled();
  });

  it('stops when the server says I already hold another slot of this test (booked from another device)', async () => {
    const s = stateOf(six());
    const claim = vi.fn(async (): Promise<LiveResult<TestSlotRow>> => ({
      ok: false,
      reason: 'conflict',
      current: row(5, ME, 3),
      holderName: 'Me',
      updatedByName: 'Me',
      heldSlot: 5,
    }));
    const out = await bookFirstFree({ available: 6, me: ME, row: (n) => viewSlot(s, T, n), busy: () => false, claim });
    expect(claim).toHaveBeenCalledOnce();
    expect(out).toEqual({ kind: 'already', slot: 5 });
  });

  it('skips slots with a write already in flight, and stops on a non-conflict failure', async () => {
    const s = stateOf(six());
    const claim = vi.fn(async (): Promise<LiveResult<TestSlotRow>> => ({ ok: false, reason: 'rate_limited' }));
    const out = await bookFirstFree({ available: 6, me: ME, row: (n) => viewSlot(s, T, n), busy: (n) => n === 1, claim });
    expect(claim).toHaveBeenCalledExactlyOnceWith(2, 0);
    expect(out).toMatchObject({ kind: 'failed', result: { reason: 'rate_limited' } });
  });
});

describe('messages', () => {
  it('names who has the slot on a lost race', () => {
    expect(takenMessage(2, { current: row(2, 'x'), holderName: 'Ben Blade', updatedByName: 'Ben Blade' })).toBe(
      'Slot 2 was taken by Ben Blade first. Yours wasn\'t applied.',
    );
    expect(takenMessage(2, { current: row(2), holderName: null, updatedByName: 'Ada' })).toBe(
      "Ada changed Slot 2 first (now empty). Yours wasn't applied.",
    );
    expect(takenMessage(4, { current: row(2, 'x'), holderName: 'Ben Blade', updatedByName: 'Ben Blade', heldSlot: 2 })).toBe(
      "Ben Blade is already in Slot 2. Yours wasn't applied.",
    );
    expect(outcomeConflictMessage(3, { current: row(3, 'x'), holderName: 'Cora', updatedByName: 'Ada' })).toBe(
      'Ada changed Slot 3 first (now Cora). Outcome not saved.',
    );
  });

  it('describes changes', () => {
    expect(slotChangeMessage(1, { memberName: 'Ada' })).toBe('Ada → Slot 1');
    expect(slotChangeMessage(1, { cleared: true })).toBe('Cleared Slot 1');
    expect(slotChangeMessage(1, { outcome: 'Passed' })).toBe('Slot 1 → Passed');
  });
});

describe('testDrawerKey', () => {
  const ctx = { focus: 1, count: 3, filled: (i: number) => i === 1 };
  it('maps 1-4 to outcomes on a filled slot only', () => {
    expect(testDrawerKey({ key: '1' }, ctx)).toEqual({ type: 'set-outcome', index: 1, outcome: 'Passed' });
    expect(testDrawerKey({ key: '2' }, ctx)).toMatchObject({ outcome: 'Failed' });
    expect(testDrawerKey({ key: '3' }, ctx)).toMatchObject({ outcome: 'No Show' });
    expect(testDrawerKey({ key: '4' }, ctx)).toMatchObject({ outcome: 'Test Booked' });
    expect(testDrawerKey({ key: '1' }, { ...ctx, focus: 0 })).toBeNull();
  });
  it('moves, opens, clears, books, undoes and closes', () => {
    expect(testDrawerKey({ key: 'j' }, ctx)).toEqual({ type: 'focus', index: 2 });
    expect(testDrawerKey({ key: 'ArrowDown' }, { ...ctx, focus: 2 })).toEqual({ type: 'focus', index: 2 });
    expect(testDrawerKey({ key: 'k' }, ctx)).toEqual({ type: 'focus', index: 0 });
    expect(testDrawerKey({ key: 'Enter' }, ctx)).toEqual({ type: 'open-picker', index: 1 });
    expect(testDrawerKey({ key: 'Enter' }, { ...ctx, count: 0 })).toBeNull();
    expect(testDrawerKey({ key: 'Backspace' }, ctx)).toEqual({ type: 'clear', index: 1 });
    expect(testDrawerKey({ key: 'Backspace' }, { ...ctx, focus: 2 })).toBeNull();
    expect(testDrawerKey({ key: 'b' }, ctx)).toEqual({ type: 'book-me' });
    expect(testDrawerKey({ key: 'z', meta: true }, ctx)).toEqual({ type: 'undo' });
    expect(testDrawerKey({ key: 'b', meta: true }, ctx)).toBeNull();
    expect(testDrawerKey({ key: 'Escape' }, ctx)).toEqual({ type: 'close' });
  });
});

describe('data helpers', () => {
  it('filters by type and parses URL params', () => {
    expect(matchesType({ type: 'Swim Test' }, 'swim')).toBe(true);
    expect(matchesType({ type: 'Capsize Drill' }, 'swim')).toBe(false);
    expect(matchesType({ type: 'Capsize Drill' }, 'capsize')).toBe(true);
    expect(matchesType({ type: null }, 'all')).toBe(true);
    expect(parseWhen('past')).toBe('past');
    expect(parseWhen(['past'])).toBe('upcoming');
    expect(parseType('capsize')).toBe('capsize');
    expect(parseType('nope')).toBe('all');
    expect(typeLabel('Capsize Drill')).toBe('Capsize drill');
  });

  it('counts the whole London day as upcoming (BST and GMT)', () => {
    expect(startOfLondonDay(new Date('2026-07-01T23:30:00Z')).toISOString()).toBe('2026-07-01T23:00:00.000Z'); // 2 Jul, BST
    expect(startOfLondonDay(new Date('2026-12-01T10:00:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('has information for both test types', () => {
    expect(testInfo('Capsize Drill')[0].text?.[0]).toContain('Capsize Drills');
    expect(testInfo('Swim Test').map((s) => s.title)).toContain('What to wear');
  });
});

describe('slotPickerItems', () => {
  const members = [
    { id: 'me', name: 'Ada Oarsworth' },
    { id: 'b', name: 'Ben Blade' },
    { id: 'c', name: 'Cora Catch' },
  ];
  it('offers Book me first, leaves out people in other slots, and Clear for a filled slot', () => {
    const items = slotPickerItems({ members, query: '', taken: { c: 2, b: 1 }, current: 'b', me: 'me' });
    expect(items.map((i) => i.kind)).toEqual(['me', 'clear', 'member', 'member']);
    expect(items.filter((i) => i.kind === 'member').map((i) => (i as { member: { id: string } }).member.id)).toEqual(['me', 'b']);
  });
  it('no Book me when you are already booked in this test', () => {
    expect(slotPickerItems({ members, query: '', taken: { me: 3 }, current: null, me: 'me' })[0].kind).toBe('member');
  });
  it('searches and offers a guest for a name not in the list', () => {
    expect(slotPickerItems({ members, query: 'ben', taken: {}, current: null, me: 'me' })).toEqual([
      { kind: 'member', member: members[1] },
      { kind: 'guest', name: 'ben' },
    ]);
    expect(slotPickerItems({ members, query: '  ben  blade ', taken: {}, current: null, me: null }).map((i) => i.kind)).toEqual([
      'member',
    ]);
    expect(slotPickerItems({ members, query: 'Zed Zee', taken: {}, current: null, me: null })).toEqual([
      { kind: 'guest', name: 'Zed Zee' },
    ]);
  });
});
