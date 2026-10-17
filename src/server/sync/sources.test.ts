import { describe, expect, it } from 'vitest';
import { londonMidnight } from './notionValues';
import {
  canonicalId,
  mapEvent,
  mapMarshalSlot,
  mapMember,
  mapOuting,
  mapSwimTest,
  sourceForParent,
} from './sources';
import { check, date, multi, num, page, relation, select, status, text, title, uid } from './testing';

const ID = '1f2e3d4c-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000001';
const SEAT_COLUMNS = ['Cox', 'Stroke', 'Bow', 'Sub 1', 'member_id', 'seat']; // outings.status is the outing's own (Notion-owned) status

describe('londonMidnight', () => {
  it('uses BST in summer and GMT in winter', () => {
    expect(londonMidnight('2026-07-01')).toBe('2026-07-01T00:00:00+01:00');
    expect(londonMidnight('2026-12-01')).toBe('2026-12-01T00:00:00+00:00');
  });

  it('gets the clock-change days right', () => {
    // Clocks go back at 01:00 UTC on 25 Oct 2026, so that midnight is still BST.
    expect(londonMidnight('2026-10-25')).toBe('2026-10-25T00:00:00+01:00');
    // Clocks go forward at 01:00 UTC on 29 Mar 2026, so that midnight is still GMT.
    expect(londonMidnight('2026-03-29')).toBe('2026-03-29T00:00:00+00:00');
  });
});

describe('mapMember', () => {
  it('maps multi_select Member Type to an array and keeps no personal data', () => {
    const row = mapMember(
      page(ID, {
        'Full Name': title('Ada Oarsworth'),
        'Member Type': multi('College Rower', 'Member'),
        'Cox Experience': select('Novice'),
        'Email Address': { type: 'email', email: 'ada@example.com' },
        'Unavailable Monday': text('[]'),
      }),
    );
    expect(row).toMatchObject({ id: ID, name: 'Ada Oarsworth', member_type: ['College Rower', 'Member'], cox_experience: 'Novice' });
    expect(Object.keys(row!).sort()).toEqual(
      ['cox_experience', 'id', 'member_type', 'name', 'notion_last_edited_at', 'synced_at'].sort(),
    );
  });

  it('skips a page with no name', () => {
    expect(mapMember(page(ID, { 'Full Name': title('') }))).toBeNull();
  });
});

describe('mapOuting', () => {
  const outing = page(ID.replace(/-/g, '').toUpperCase(), {
    'Outing ID': uid(42),
    Name: title('M1 water'),
    Type: select('Water Outing'),
    Div: select('O1'),
    Shell: select('Sims'),
    'Start Date/Time': date('2026-10-18T07:00:00.000+01:00'),
    'End Date/Time': date('2026-10-18T08:30:00.000+01:00'),
    Status: status('Confirmed'),
    'Publish Outing': check(true),
    Details: text('Steady state'),
    Cox: relation(MEMBER),
    'Cox Status': status('Available'),
    'Outing Summary': text('Good'),
  });

  it('maps the Notion-owned details', () => {
    expect(mapOuting(outing)).toMatchObject({
      id: ID,
      outing_no: 42,
      name: 'M1 water',
      type: 'Water Outing',
      div: 'O1',
      shell: 'Sims',
      start_at: '2026-10-18T07:00:00.000+01:00',
      end_at: '2026-10-18T08:30:00.000+01:00',
      status: 'Confirmed',
      publish: true,
      details: 'Steady state',
      notion_last_edited_at: '2026-10-17T09:00:00.000Z',
    });
  });

  it('never carries seats, statuses or report fields (app-owned)', () => {
    const keys = Object.keys(mapOuting(outing));
    for (const col of [...SEAT_COLUMNS, 'Cox Status', 'outing_summary', 'version', 'updated_by']) {
      expect(keys).not.toContain(col);
    }
  });

  it('falls back to "Session Details" and drops an unknown status', () => {
    const row = mapOuting(page(ID, { 'Session Details': text('Old field'), Status: status('Postponed') }));
    expect(row.details).toBe('Old field');
    expect(row.status).toBeNull();
  });

  it('stores a date-only start as midnight Europe/London', () => {
    const row = mapOuting(page(ID, { 'Start Date/Time': date('2026-11-02') }));
    expect(row.start_at).toBe('2026-11-02T00:00:00+00:00');
  });
});

describe('mapEvent', () => {
  it('marks a date-only event all-day and keeps files as returned', () => {
    const files = [{ type: 'external', name: 'poster', external: { url: 'https://example.com/p.png' } }];
    const row = mapEvent(
      page(ID, {
        Event: title('Boat Club Dinner'),
        Description: text('Black tie'),
        Date: date('2026-11-20', '2026-11-21'),
        'Embedded Form': text('<iframe/>'),
        'Files & media': { type: 'files', files },
      }),
    );
    expect(row).toMatchObject({
      title: 'Boat Club Dinner',
      description: 'Black tie',
      start_at: '2026-11-20T00:00:00+00:00',
      end_at: '2026-11-21T00:00:00+00:00',
      all_day: true,
      embedded_form: '<iframe/>',
      files,
    });
  });
});

describe('mapSwimTest', () => {
  it('maps the definition and clamps Available Slots to 0..6', () => {
    const row = mapSwimTest(
      page(ID, {
        'OURC Test': title('Swim test, Iffley'),
        Type: select('Swim Test'),
        'Available Slots': num(9),
        Date: date('2026-10-20T18:00:00.000+01:00'),
        'Slot 1': relation(MEMBER),
        'Slot 1 Outcome': status('Passed'),
      }),
    );
    expect(row).toMatchObject({ title: 'Swim test, Iffley', type: 'Swim Test', available_slots: 6, all_day: false });
    expect(Object.keys(row).some((k) => k.startsWith('slot') || k === 'member_id' || k === 'outcome')).toBe(false);
  });
});

describe('mapMarshalSlot', () => {
  it('maps definition columns and never the sign-up (app-owned)', () => {
    const row = mapMarshalSlot(
      page(ID, {
        Name: title('Longbridges S1'),
        'Slot ID': uid(7),
        Event: select('Eights 2026'),
        Day: select('Wed'),
        Shift: select('S1'),
        Role: select('Marshal'),
        Location: select('Longbridges'),
        'Slot Time': date('2026-05-27T12:00:00.000+01:00', '2026-05-27T14:00:00.000+01:00'),
        Notes: text('Bring a whistle'),
        Publish: check(true),
        'Clash Crews': multi('M3', 'W3'),
        Person: relation(MEMBER),
        'Person Status': select('Confirmed'),
      }),
    );
    expect(row).toMatchObject({
      name: 'Longbridges S1',
      slot_no: 7,
      event: 'Eights 2026',
      day: 'Wed',
      shift: 'S1',
      role: 'Marshal',
      location: 'Longbridges',
      end_at: '2026-05-27T14:00:00.000+01:00',
      publish: true,
      clash_crews: ['M3', 'W3'],
    });
    expect(row).not.toHaveProperty('person_id');
    expect(row).not.toHaveProperty('person_status');
  });
});

describe('ids', () => {
  it('canonicalises ids and finds a source by database or data source id', () => {
    expect(canonicalId('1F2E3D4C000040008000000000000001')).toBe(ID);
    expect(sourceForParent(undefined, '23d80040a8fa80edafaff6c83477d5d0')?.key).toBe('outings');
    expect(sourceForParent('930f9a4b-c9d9-498a-be7b-f88e7ae85931')?.key).toBe('marshal_slots');
    expect(sourceForParent('00000000-0000-4000-8000-000000000000')).toBeUndefined();
  });
});
