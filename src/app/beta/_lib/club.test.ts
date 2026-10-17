import { describe, expect, it, vi } from 'vitest';
import type { LiveResult } from '@/lib/live/types';
import {
  claimPatch,
  conflictText,
  groupSlots,
  initSlots,
  marshalKey,
  performClaim,
  personTone,
  slotReducer,
  viewSlots,
  type MarshalSlot,
  type SlotAction,
} from './club-marshal';
import { eventWhen, findBySlug, parseEmbeddedForm, splitEvents, startOfLondonDay, type ClubEvent } from './club-events';
import { FLAG_RULES, flagColour, noticeList, setAtLabel } from './club-flag';

const ADA = 'aaaaaaaa-0000-4000-8000-000000000001';
const BEN = 'aaaaaaaa-0000-4000-8000-000000000002';

function slot(over: Partial<MarshalSlot> & { id: string }): MarshalSlot {
  return {
    name: over.id,
    slot_no: null,
    event: 'Eights 2026',
    day: 'Wed',
    shift: 'S1',
    role: 'Marshal',
    location: 'Longbridges',
    start_at: '2026-05-27T08:00:00Z',
    end_at: '2026-05-27T10:00:00Z',
    all_day: false,
    notes: null,
    clash_crews: [],
    person_id: null,
    person_status: 'Open',
    version: 0,
    updated_by: null,
    updated_at: '2026-05-01T00:00:00Z',
    ...over,
  };
}

describe('marshalling: grouping', () => {
  it('groups event → London day → shift, in time order, with filled counts', () => {
    const groups = groupSlots([
      slot({ id: 'c', shift: 'S2', start_at: '2026-05-27T10:00:00Z', person_id: ADA }),
      slot({ id: 'a', slot_no: 2 }),
      slot({ id: 'b', slot_no: 1 }),
      slot({ id: 'd', day: 'Thu', start_at: '2026-05-27T23:30:00Z' }), // 00:30 BST on Thu 28 May
      slot({ id: 'e', event: 'Torpids 2026', start_at: '2026-03-04T09:00:00Z' }),
    ]);
    expect(groups.map((g) => g.event)).toEqual(['Torpids 2026', 'Eights 2026']);
    const eights = groups[1];
    expect(eights).toMatchObject({ total: 4, filled: 1 });
    expect(eights.days.map((d) => d.label)).toEqual(['Wed 27 May', 'Thu 28 May']);
    expect(eights.days[0].shifts.map((s) => [s.shift, s.slots.map((x) => x.id)])).toEqual([
      ['S1', ['b', 'a']],
      ['S2', ['c']],
    ]);
  });

  it('keeps undated slots, last', () => {
    const [g] = groupSlots([slot({ id: 'x', start_at: null, day: 'Sat' }), slot({ id: 'y' })]);
    expect(g.days.map((d) => d.label)).toEqual(['Wed 27 May', 'Sat']);
  });
});

describe('marshalling: optimistic state', () => {
  it('shows a pending sign-up on top, and a late echo of an older row never wins', () => {
    let s = initSlots([slot({ id: 'a', version: 3 })]);
    s = slotReducer(s, { type: 'optimistic', opId: 1, id: 'a', patch: claimPatch(ADA) });
    expect(viewSlots(s)[0]).toMatchObject({ person_id: ADA, person_status: 'Confirmed' });
    s = slotReducer(s, { type: 'settled', opId: 1, id: 'a', row: slot({ id: 'a', version: 4, person_id: ADA, person_status: 'Confirmed' }) });
    s = slotReducer(s, { type: 'remote', row: slot({ id: 'a', version: 3 }) });
    expect(viewSlots(s)[0]).toMatchObject({ version: 4, person_id: ADA });
    expect(s.pending).toEqual({});
  });

  it('a failed write rolls back; hide removes an unpublished slot', () => {
    let s = initSlots([slot({ id: 'a' }), slot({ id: 'b' })]);
    s = slotReducer(s, { type: 'optimistic', opId: 7, id: 'a', patch: claimPatch(ADA) });
    s = slotReducer(s, { type: 'failed', opId: 7, id: 'a' });
    expect(viewSlots(s).find((x) => x.id === 'a')?.person_id).toBeNull();
    s = slotReducer(s, { type: 'hide', id: 'b' });
    expect(viewSlots(s).map((x) => x.id)).toEqual(['a']);
  });

  it('clearing goes back to Open', () => {
    expect(claimPatch(null)).toEqual({ person_id: null, person_status: 'Open' });
  });
});

describe('marshalling: one write (first wins)', () => {
  const run = async (result: LiveResult<MarshalSlot>, memberId: string | null = ADA) => {
    const actions: SlotAction[] = [];
    const send = vi.fn(async () => result);
    const outcome = await performClaim(slot({ id: 'a', version: 5 }), memberId, ADA, 1, (a) => actions.push(a), send);
    return { outcome, actions, send };
  };

  it('sends the version on screen and settles with the server row', async () => {
    const row = slot({ id: 'a', version: 6, person_id: ADA, person_status: 'Confirmed' });
    const { outcome, actions, send } = await run({ ok: true, changeId: 42, row, outingStatus: null });
    expect(send).toHaveBeenCalledWith({ slotId: 'a', memberId: ADA, actorId: ADA, expectedVersion: 5 });
    expect(actions.map((a) => a.type)).toEqual(['optimistic', 'settled']);
    expect(outcome).toEqual({ kind: 'ok', changeId: 42, row });
  });

  it('a conflict shows who took the slot and applies their row', async () => {
    const theirs = slot({ id: 'a', version: 6, person_id: BEN, person_status: 'Confirmed', updated_by: BEN });
    const { outcome, actions } = await run({ ok: false, reason: 'conflict', current: theirs, holderName: 'Ben Blade', updatedByName: 'Ben Blade' });
    expect(outcome).toEqual({ kind: 'conflict', text: "Ben Blade took this slot. Yours wasn't applied." });
    expect(actions[1]).toEqual({ type: 'settled', opId: 1, id: 'a', row: theirs });
  });

  it('a conflict on a slot someone cleared says so', () => {
    expect(conflictText({ current: slot({ id: 'a' }), holderName: null, updatedByName: 'Ben Blade' })).toBe(
      "Ben Blade cleared this slot first. Yours wasn't applied.",
    );
  });

  it('errors roll back', async () => {
    const { outcome, actions } = await run({ ok: false, reason: 'error' });
    expect(actions.map((a) => a.type)).toEqual(['optimistic', 'failed']);
    expect(outcome.kind).toBe('error');
    expect((await run({ ok: false, reason: 'not_found' })).outcome).toEqual({ kind: 'error', text: 'This slot no longer exists.' });
  });
});

describe('marshalling: keys and tones', () => {
  const ctx = { focus: 1, count: 3, filled: (i: number) => i === 2 };
  it('maps keys to intents', () => {
    expect(marshalKey({ key: 'j' }, ctx)).toEqual({ type: 'focus', index: 2 });
    expect(marshalKey({ key: 'j' }, { ...ctx, focus: -1 })).toEqual({ type: 'focus', index: 0 });
    expect(marshalKey({ key: 'k' }, { ...ctx, focus: 0 })).toEqual({ type: 'focus', index: 0 });
    expect(marshalKey({ key: 's' }, ctx)).toEqual({ type: 'sign-me-up', index: 1 });
    expect(marshalKey({ key: 's' }, { ...ctx, focus: 2 })).toBeNull(); // already filled
    expect(marshalKey({ key: 'Backspace' }, ctx)).toBeNull(); // nothing to clear
    expect(marshalKey({ key: 'Backspace' }, { ...ctx, focus: 2 })).toEqual({ type: 'clear', index: 2 });
    expect(marshalKey({ key: 'z', meta: true }, ctx)).toEqual({ type: 'undo' });
    expect(marshalKey({ key: 's', meta: true }, ctx)).toBeNull();
    expect(marshalKey({ key: 'Enter' }, { ...ctx, focus: -1 })).toBeNull();
  });

  it('colours state only', () => {
    expect(personTone({ person_id: null, person_status: 'Open' })).toBe('unk');
    expect(personTone({ person_id: ADA, person_status: 'Confirmed' })).toBe('ok');
    expect(personTone({ person_id: ADA, person_status: 'Reserved' })).toBe('maybe');
  });
});

const ev = (over: Partial<ClubEvent> & { id: string; title: string }): ClubEvent => ({
  description: null,
  start_at: null,
  end_at: null,
  all_day: false,
  embedded_form: null,
  ...over,
});

describe('events', () => {
  const now = new Date('2026-10-18T21:00:00Z'); // 22:00 BST on Sun 18 Oct

  it('London midnight', () => {
    expect(startOfLondonDay(now).toISOString()).toBe('2026-10-17T23:00:00.000Z');
  });

  it('splits upcoming (from the start of today) and past, leaves undated out', () => {
    const events = [
      ev({ id: '1', title: 'Old', start_at: '2025-10-07T14:00:00Z' }),
      ev({ id: '2', title: 'This morning', start_at: '2026-10-18T07:00:00Z' }),
      ev({ id: '3', title: 'Dinner', start_at: '2026-11-29T00:00:00Z', all_day: true }),
      ev({ id: '4', title: 'Untitled Event' }),
      ev({ id: '5', title: 'Older', start_at: '2025-01-01T00:00:00Z' }),
    ];
    const { upcoming, past } = splitEvents(events, now);
    expect(upcoming.map((e) => e.id)).toEqual(['2', '3']);
    expect(past.map((e) => e.id)).toEqual(['1', '5']);
  });

  it('finds a repeated title by slug: the next upcoming one, else the latest past one', () => {
    const events = [
      ev({ id: 'a', title: 'OURCs Coxing Registration', start_at: '2025-10-12T15:45:00Z' }),
      ev({ id: 'b', title: 'OURCs Coxing Registration', start_at: '2025-10-21T17:15:00Z' }),
    ];
    expect(findBySlug(events, 'ourcs-coxing-registration', now)?.id).toBe('b');
    expect(findBySlug([...events, ev({ id: 'c', title: 'OURCs Coxing Registration', start_at: '2026-10-25T10:00:00Z' })], 'ourcs-coxing-registration', now)?.id).toBe('c');
    expect(findBySlug(events, 'nope', now)).toBeNull();
  });

  it('formats when, all-day by its London date', () => {
    expect(eventWhen({ start_at: '2026-05-29T23:00:00Z', end_at: null, all_day: true })).toMatchObject({ day: 'Sat 30 May', time: 'All day' });
    expect(eventWhen({ start_at: '2025-11-07T20:30:00Z', end_at: '2025-11-08T00:30:00Z', all_day: false }).time).toBe('20:30–00:30');
  });

  it('reads only an https src (and height) from the embedded form snippet', () => {
    expect(parseEmbeddedForm('<iframe src="https://forms.gle/tA6HqdKkcLfPqwVs8" width="100%" height="800" frameborder="0" allowfullscreen />')).toEqual({
      src: 'https://forms.gle/tA6HqdKkcLfPqwVs8',
      height: 800,
    });
    expect(parseEmbeddedForm('https://docs.google.com/forms/d/e/x/viewform?a=1&amp;b=2')).toEqual({
      src: 'https://docs.google.com/forms/d/e/x/viewform?a=1&b=2',
      height: 800,
    });
    expect(parseEmbeddedForm('<iframe src="javascript:alert(1)"></iframe>')).toBeNull();
    expect(parseEmbeddedForm('<iframe src="http://example.com"></iframe>')).toBeNull();
    expect(parseEmbeddedForm('<script>alert(1)</script>')).toBeNull();
    expect(parseEmbeddedForm(null)).toBeNull();
    expect(parseEmbeddedForm("<iframe height='99999' src='https://x.example/f'>")?.height).toBe(2000);
  });
});

describe('flag', () => {
  it('reads the colour from status_text', () => {
    expect(flagColour('Green')).toBe('Green');
    expect(flagColour('Light Blue Flag')).toBe('Light Blue');
    expect(flagColour('dark blue')).toBe('Dark Blue');
    expect(flagColour('Purple')).toBeNull();
    expect(flagColour(undefined)).toBeNull();
  });

  it('has the bank-rider rules the auto-confirm SQL applies', () => {
    expect(FLAG_RULES.Green.bankRider).toMatch(/Novice/);
    expect(FLAG_RULES.Amber.bankRider).toMatch(/every water outing/);
    expect(FLAG_RULES.Red.crewsOut).toBe(false);
    expect(FLAG_RULES.Black.crewsOut).toBe(false);
    expect(FLAG_RULES['Light Blue'].register).toBe(true);
  });

  it('normalises notices and the set time', () => {
    expect(noticeList(['a', ' ', 'b '])).toEqual(['a', 'b']);
    expect(noticeList('one')).toEqual(['one']);
    expect(noticeList(undefined)).toEqual([]);
    expect(setAtLabel('2026-10-10T09:48:43.445Z')).toBe('Sat 10 Oct 10:48');
    expect(setAtLabel('nonsense')).toBeNull();
  });
});
