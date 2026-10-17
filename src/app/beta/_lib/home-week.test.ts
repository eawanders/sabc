import { describe, expect, it } from 'vitest';
import type { SeatRow } from '@/lib/live/types';
import { coxWeeks, dayFit, flagLabel, isNoGoFlag, whenLabel } from './home-data';
import { emptyMine, inFilter, mineReducer, myRows, REPLIES, type MyOuting } from './myweek-state';

const ME = 'me';
const outing = (id: string, start: string, name = id): MyOuting => ({
  id,
  name,
  type: 'Water Outing',
  div: 'M1',
  shell: null,
  start_at: start,
  end_at: null,
  status: 'Provisional',
});
const seat = (outing_id: string, s: string, member_id: string | null, version = 1, status: string | null = 'Awaiting Approval'): SeatRow => ({
  outing_id,
  seat: s,
  member_id,
  status,
  version,
  updated_by: null,
  updated_at: '2026-10-18T00:00:00Z',
});

describe('my week rows', () => {
  const loaded = mineReducer(emptyMine, {
    type: 'load',
    outings: [outing('b', '2026-10-21T06:00:00Z'), outing('a', '2026-10-19T06:00:00Z')],
    rows: [
      seat('a', 'Stroke', ME),
      seat('a', 'Bow', 'x'),
      seat('a', 'Coach/Bank Rider', 'y'),
      seat('b', 'Sub 1', ME),
      seat('b', 'Cox', ME), // two seats in one outing: both listed, drawer order
      seat('b', '7 Seat', null),
    ],
  });

  it('lists my seats by start time, with crew counted from the nine crew seats only', () => {
    const rows = myRows(loaded, ME);
    expect(rows.map((r) => r.key)).toEqual(['a|Stroke', 'b|Cox', 'b|Sub 1']);
    expect(rows[0].crewFilled).toBe(2); // Stroke + Bow; the bank rider doesn't count
    expect(rows[1].crewFilled).toBe(1);
    expect(myRows(loaded, null)).toEqual([]);
  });

  it('shows a reply at once, settles it, and rolls back on a conflict', () => {
    let s = mineReducer(loaded, { type: 'seat', outingId: 'a', action: { type: 'optimistic', opId: 1, seat: 'Stroke', patch: { status: 'Available' } } });
    expect(myRows(s, ME)[0]).toMatchObject({ pending: true, row: { status: 'Available' } });
    s = mineReducer(s, { type: 'seat', outingId: 'a', action: { type: 'settled', opId: 1, seat: 'Stroke', rows: [seat('a', 'Stroke', ME, 2, 'Available')] } });
    expect(myRows(s, ME)[0]).toMatchObject({ pending: false, row: { status: 'Available', version: 2 } });

    // Someone moved me out before my reply landed: the row goes away
    s = mineReducer(s, { type: 'seat', outingId: 'a', action: { type: 'optimistic', opId: 2, seat: 'Stroke', patch: { status: 'Not Available' } } });
    s = mineReducer(s, { type: 'seat', outingId: 'a', action: { type: 'settled', opId: 2, seat: 'Stroke', rows: [seat('a', 'Stroke', 'z', 3, 'Available')] } });
    expect(myRows(s, ME).map((r) => r.key)).toEqual(['b|Cox', 'b|Sub 1']);
  });

  it('applies Realtime rows and outing changes, ignoring outings it does not hold', () => {
    let s = mineReducer(loaded, { type: 'seat', outingId: 'b', action: { type: 'remote', row: seat('b', '7 Seat', 'q', 2) } });
    expect(myRows(s, ME)[1].crewFilled).toBe(2);
    s = mineReducer(s, { type: 'outing', outing: { id: 'b', status: 'Confirmed' } });
    expect(s.outings.b.status).toBe('Confirmed');
    expect(mineReducer(s, { type: 'seat', outingId: 'zzz', action: { type: 'remote', row: seat('zzz', 'Bow', ME) } })).toBe(s);
    expect(mineReducer(s, { type: 'outing', outing: { id: 'zzz', status: 'Confirmed' } })).toBe(s);
  });

  it('keeps a reply in flight across a reload', () => {
    const s = mineReducer(loaded, { type: 'seat', outingId: 'a', action: { type: 'optimistic', opId: 9, seat: 'Stroke', patch: { status: 'Maybe Available' } } });
    const reloaded = mineReducer(s, { type: 'load', outings: [outing('a', '2026-10-19T06:00:00Z')], rows: [seat('a', 'Stroke', ME)] });
    expect(myRows(reloaded, ME)[0]).toMatchObject({ pending: true, row: { status: 'Maybe Available' } });
  });

  it('maps the three replies to the stored statuses', () => {
    expect(REPLIES.map((r) => r.status)).toEqual(['Available', 'Maybe Available', 'Not Available']);
  });

  it('builds stable Realtime filters', () => {
    expect(inFilter('outing_id', [])).toBeNull();
    expect(inFilter('id', ['b', 'a'])).toBe('id=in.(a,b)');
  });
});

describe('home helpers', () => {
  it('classifies a cox day as free, partial or blocked', () => {
    expect(dayFit(undefined)).toBe('free');
    expect(dayFit([])).toBe('free');
    expect(dayFit([{ start: '09:00', end: '12:00' }])).toBe('partial');
    expect(dayFit([{ start: '00:00', end: '23:59' }])).toBe('blocked');
    expect(dayFit([{ start: '12:00', end: '23:59' }, { start: '00:00', end: '12:00' }])).toBe('blocked');
  });

  it('lists coxes by name, dropping non-coxes and coxes blocked all week', () => {
    const allDay = [{ start: '00:00', end: '23:59' }];
    const members = [
      { id: '1', name: 'Zed', cox_experience: 'Novice' },
      { id: '2', name: 'Amy', cox_experience: 'Experienced' },
      { id: '3', name: 'Rower', cox_experience: null },
      { id: '4', name: 'Blank', cox_experience: '  ' },
      { id: '5', name: 'Away', cox_experience: 'Novice' },
    ];
    const week = Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, allDay]));
    const out = coxWeeks(members, { '2': { monday: allDay, tuesday: [{ start: '07:00', end: '09:00' }] }, '5': week });
    expect(out.map((c) => c.name)).toEqual(['Amy', 'Zed']);
    expect(out[0].days).toEqual(['blocked', 'partial', 'free', 'free', 'free', 'free', 'free']);
  });

  it('formats event times in London', () => {
    expect(whenLabel('2026-10-24T18:00:00Z')).toBe('Sat 24 Oct, 19:00');
    expect(whenLabel('2026-11-07T00:00:00Z', true)).toBe('Sat 7 Nov');
  });

  it('flags red and black as no-go and labels the flag', () => {
    expect(isNoGoFlag('Red')).toBe(true);
    expect(isNoGoFlag('Black Flag')).toBe(true);
    expect(isNoGoFlag('Amber')).toBe(false);
    expect(isNoGoFlag(null)).toBe(false);
    expect(flagLabel('Light Blue')).toBe('Light Blue flag');
    expect(flagLabel('Green Flag')).toBe('Green flag');
    expect(flagLabel(null)).toBeNull();
  });
});
