import { describe, expect, it } from 'vitest';
import { getSessionAvailability } from '@/utils/rowerAvailability';
import { getEligibleCoxesUnified } from '@/utils/coxEligibility';
import { Member } from '@/types/members';

const emptyWeek = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
const blockedMonday = { ...emptyWeek, monday: [{ start: '00:00', end: '23:59' }] };
// 2025-10-13 is a Monday (local noon, so the weekday holds in any timezone)
const MONDAY = '2025-10-13T12:00:00';

describe('getSessionAvailability', () => {
  it('is unknown, not available, when the availability load failed', () => {
    expect(getSessionAvailability(undefined, true, MONDAY, '07:00', '09:00')).toBe('unknown');
    expect(getSessionAvailability(blockedMonday, true, MONDAY, '07:00', '09:00')).toBe('unknown');
  });

  it('reads a loaded week', () => {
    expect(getSessionAvailability(emptyWeek, false, MONDAY, '07:00', '09:00')).toBe('available');
    expect(getSessionAvailability(blockedMonday, false, MONDAY, '07:00', '09:00')).toBe('unavailable');
  });
});

describe('getEligibleCoxesUnified', () => {
  const cox: Member = { id: 'cox-1', name: 'Cox One', memberType: 'Cox', coxExperience: 'Senior' };

  it('does not filter coxes by availability it could not load', () => {
    const blocked = new Map([['cox-1', blockedMonday]]);
    expect(getEligibleCoxesUnified([cox], 'green', MONDAY, '2025-10-13T07:00:00', '2025-10-13T09:00:00', blocked)).toEqual([]);
    expect(getEligibleCoxesUnified([cox], 'green', MONDAY, '2025-10-13T07:00:00', '2025-10-13T09:00:00', new Map(), true)).toEqual([cox]);
  });
});
