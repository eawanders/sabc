import { describe, expect, it } from 'vitest';
import { changedFields, draftFrom } from '../../_components/useReport';
import { isNewName } from '../../_components/MemberPicker';
import { addMonths, isMonth, londonDate, monthGrid, monthLabel, monthOf } from './calendar';
import { applyFilters, divisions, readFilters, withFilters } from './filters';
import { countCrew, crewSize, type ScheduleOuting } from './load';
import { bankRiderRequired, confirmRequirements, coxEligible, flagRequirements, flagStopsOutings, subSwaps } from './rules';
import { googleCalendarUrl, icsFile, outingLink, outingTitle } from './share';

type Seat = { member_id: string | null; status: string | null };
const view = (seats: Record<string, Seat>) => (s: string) => seats[s] ?? { member_id: null, status: null };
const full = (status = 'Available'): Record<string, Seat> =>
  Object.fromEntries(['Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat', '4 Seat', '3 Seat', '2 Seat', 'Bow'].map((s, i) => [s, { member_id: `m${i}`, status }]));

describe('bank rider rule (mirrors recompute_outing_status W2)', () => {
  it.each([
    ['Green', 'Novice', true],
    ['Green', 'Novice (less than 1 term)', true],
    ['Green', 'Senior', false],
    ['Light Blue', 'Novice', true],
    ['Light Blue', 'Novice (less than 1 term)', false],
    ['Light Blue', 'Experienced', false],
    ['Amber', 'Senior', true],
    ['Amber', null, true],
    ['Dark Blue', 'Novice', false],
    [null, 'Novice', false],
  ])('%s flag, %s cox → %s', (flag, cox, expected) => {
    expect(bankRiderRequired(flag, cox)).toBe(expected);
  });

  it('red and black stop outings', () => {
    expect(flagStopsOutings('Red')).toBe(true);
    expect(flagStopsOutings('black')).toBe(true);
    expect(flagStopsOutings('Amber')).toBe(false);
  });
});

describe('cox eligibility', () => {
  it.each([
    ['Green', 'Novice (less than 1 term)', true],
    ['Grey', null, true],
    ['Light Blue', 'Novice', true],
    ['Light Blue', 'Novice (less than 1 term)', false],
    ['Dark Blue', 'Novice', false],
    ['Dark Blue', 'Experienced', true],
    ['Amber', 'Experienced', false],
    ['Amber', 'Senior', true],
    ['Red', 'Senior', false],
    ['Light Blue', null, null],
    [null, 'Senior', null],
  ])('%s flag, %s → %s', (flag, exp, expected) => {
    expect(coxEligible(flag, exp)).toBe(expected);
  });

  it('gives the requirement text per flag, with the register link on light blue', () => {
    expect(flagRequirements('Green').text).toBe('Novice coxes must have a bankrider.');
    expect(flagRequirements('Light Blue Flag').registerUrl).toMatch(/^https:\/\/docs\.google\.com\/forms\//);
    expect(flagRequirements('Red').text).toBe('No crews are allowed out.');
    expect(flagRequirements(null).text).toBe('Requirements not available.');
  });
});

describe('confirm requirements', () => {
  it('water: nine available, bank rider when required, a flag that allows outings', () => {
    const seats = full();
    seats['Bow'] = { member_id: 'm8', status: 'Maybe Available' };
    const reqs = confirmRequirements({ type: 'Water Outing', flag: 'Amber', coxExperience: 'Senior', view: view(seats) });
    expect(reqs.map((r) => [r.key, r.met])).toEqual([
      ['crew', false],
      ['bank', false],
      ['flag', true],
    ]);
    expect(reqs[0].label).toBe('Nine crew available (8/9)');
  });

  it('water on green with a senior cox needs no bank rider; red is not met', () => {
    const reqs = confirmRequirements({ type: 'Water Outing', flag: 'Red', coxExperience: 'Senior', view: view(full()) });
    expect(reqs.map((r) => r.key)).toEqual(['crew', 'flag']);
    expect(reqs[1]).toMatchObject({ met: false, label: 'Red flag: no crews out' });
  });

  it('other sessions: everyone seated outside the subs is available', () => {
    const v = view({ Stroke: { member_id: 'a', status: 'Available' }, 'Sub 1': { member_id: 'b', status: 'Not Available' } });
    expect(confirmRequirements({ type: 'Erg Session', flag: null, coxExperience: null, view: v })).toEqual([
      { key: 'all', label: 'Everyone seated available (1/1)', met: true },
    ]);
    expect(confirmRequirements({ type: 'Erg Session', flag: null, coxExperience: null, view: view({}) })[0]).toMatchObject({
      met: false,
      label: 'Someone seated',
    });
  });
});

describe('swap in subs', () => {
  it('pairs Not Available rowers (stroke→bow, never the cox) with Available subs (1→4)', () => {
    const seats = full();
    seats['Cox'] = { member_id: 'c', status: 'Not Available' };
    seats['6 Seat'] = { member_id: 'r6', status: 'Not Available' };
    seats['2 Seat'] = { member_id: 'r2', status: 'Not Available' };
    seats['Bow'] = { member_id: 'rb', status: 'Not Available' };
    seats['Sub 1'] = { member_id: 's1', status: 'Maybe Available' };
    seats['Sub 2'] = { member_id: 's2', status: 'Available' };
    seats['Sub 4'] = { member_id: 's4', status: 'Available' };
    expect(subSwaps(view(seats))).toEqual([
      { crew: '6 Seat', sub: 'Sub 2' },
      { crew: '2 Seat', sub: 'Sub 4' },
    ]);
  });

  it('is empty without an available sub or a not-available rower', () => {
    expect(subSwaps(view(full()))).toEqual([]);
    const seats = full();
    seats['5 Seat'] = { member_id: 'r', status: 'Not Available' };
    expect(subSwaps(view(seats))).toEqual([]);
  });
});

const outing = (o: Partial<ScheduleOuting>): ScheduleOuting => ({
  id: 'x', name: 'O', type: 'Water Outing', div: 'M1', shell: null, start_at: null, end_at: null, status: null, crewFilled: 0, seats: [], ...o,
});

describe('filters', () => {
  const ADA = '00000000-0000-4000-8000-000000000001';
  it('reads only valid values from the URL', () => {
    const p = new URLSearchParams(`type=erg&div=W1&member=${ADA.toUpperCase()}`);
    expect(readFilters(p)).toEqual({ type: 'erg', div: 'W1', member: ADA });
    expect(readFilters(new URLSearchParams('type=boat&member=bob&div='))).toEqual({ type: null, div: null, member: null });
  });

  it('writes filters and keeps the rest of the query', () => {
    expect(withFilters('week=2026-10-19&type=erg', { type: null, div: 'M1' })).toBe('week=2026-10-19&div=M1');
  });

  it('filters by type, division and member (any seat, subs and bank rider included)', () => {
    const list = [
      outing({ id: 'a', type: 'Water Outing', div: 'M1', seats: [{ seat: 'Sub 2', member_id: ADA }] }),
      outing({ id: 'b', type: 'Erg Session', div: 'W1', seats: [{ seat: 'Coach/Bank Rider', member_id: ADA }] }),
      outing({ id: 'c', type: 'Water Outing', div: 'W1' }),
    ];
    expect(applyFilters(list, { type: 'water', div: null, member: null }).map((o) => o.id)).toEqual(['a', 'c']);
    expect(applyFilters(list, { type: null, div: 'W1', member: ADA }).map((o) => o.id)).toEqual(['b']);
    expect(divisions(list)).toEqual(['M1', 'W1']);
  });
});

describe('crew counts', () => {
  it('counts nine seats for water and eight (no cox) otherwise', () => {
    const seats = [{ seat: 'Cox' }, { seat: 'Bow' }, { seat: 'Sub 1' }, { seat: 'Coach/Bank Rider' }];
    expect([crewSize('Water Outing'), countCrew('Water Outing', seats)]).toEqual([9, 2]);
    expect([crewSize('Erg Session'), countCrew('Erg Session', seats)]).toEqual([8, 1]);
  });
});

describe('month calendar', () => {
  it('validates and steps months', () => {
    expect(isMonth('2026-10')).toBe(true);
    expect(isMonth('2026-13')).toBe(false);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-10')).toBe('October 2026');
  });

  it('builds whole Monday–Sunday weeks around the month, in London time', () => {
    const g = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday; 31 Oct a Saturday
    expect(g.days[0]).toBe('2026-09-28');
    expect(g.days.at(-1)).toBe('2026-11-01');
    expect(g.days).toHaveLength(35);
    expect(g.start.toISOString()).toBe('2026-09-27T23:00:00.000Z'); // BST midnight
    expect(g.end.toISOString()).toBe('2026-11-02T00:00:00.000Z'); // GMT midnight
  });

  it('dates instants in London', () => {
    expect(londonDate(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19');
    expect(monthOf(new Date('2026-10-31T23:30:00Z'))).toBe('2026-10'); // GMT by then
  });
});

describe('share and calendar', () => {
  const start = new Date('2026-10-19T06:00:00Z');
  it('links to the outing in its week', () => {
    expect(outingLink('https://sabcoxford.com', 'abc', '2026-10-19')).toBe('https://sabcoxford.com/beta/schedule?week=2026-10-19&outing=abc');
  });

  it('builds a Google Calendar link with a 1 h fallback end', () => {
    const url = new URL(googleCalendarUrl({ title: 'M1 water', start, end: null }));
    expect(url.searchParams.get('text')).toBe('SABC: M1 water');
    expect(url.searchParams.get('dates')).toBe('20261019T060000Z/20261019T070000Z');
    expect(url.searchParams.get('location')).toBe("St Anne's College Boat Club");
  });

  it('writes an escaped .ics', () => {
    const ics = icsFile({ id: 'abc', title: 'M1, water', details: 'Line 1\nLine 2; ok', start, end: new Date('2026-10-19T08:00:00Z') }, new Date('2026-10-18T00:00:00Z'));
    expect(ics).toContain('DTSTART:20261019T060000Z\r\nDTEND:20261019T080000Z');
    expect(ics).toContain('SUMMARY:SABC: M1\\, water');
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2\\; ok');
  });

  it('titles an outing as the current drawer does', () => {
    expect(outingTitle({ div: 'O1', type: 'Water Outing' })).toBe('O1 Water Outing');
    expect(outingTitle({ type: 'Erg Session' })).toBe('Erg Session Outing');
    expect(outingTitle({})).toBe('Unnamed Outing');
  });
});

describe('report draft', () => {
  it('sends only changed fields, an emptied one as null', () => {
    const base = draftFrom({
      outing_id: 'o', outing_summary: 'Long row', boat_feel: 'Heavy', outing_successes: null, next_focus: null, coach_feedback: null,
      version: 3, updated_by: null, updated_at: '',
    });
    expect(changedFields(base, { ...base, boatFeel: '', nextFocus: 'Catch timing' })).toEqual({ boatFeel: null, nextFocus: 'Catch timing' });
    expect(changedFields(base, { ...base, outingSummary: 'Long row  ' })).toEqual({});
  });
});

describe('guest names in the picker', () => {
  it('offers a guest only for a new name of 2–80 characters', () => {
    const members = [{ name: 'Ada Oarsworth' }];
    expect(isNewName('ada  oarsworth', members)).toBe(false);
    expect(isNewName('Grace Hopper', members)).toBe(true);
    expect(isNewName('G', members)).toBe(false);
    expect(isNewName('x'.repeat(81), members)).toBe(false);
  });
});
