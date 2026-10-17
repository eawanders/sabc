import { describe, expect, it, vi } from 'vitest';
import { parseTimeRanges } from '@/types/rowerAvailability';

describe('parseTimeRanges', () => {
  it('parses a valid JSON array of ranges', () => {
    expect(parseTimeRanges('[{"start":"09:00","end":"10:00"}]')).toEqual([
      { start: '09:00', end: '10:00' },
    ]);
  });

  it('returns an empty array for empty or invalid input', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseTimeRanges('')).toEqual([]);
    expect(parseTimeRanges(null)).toEqual([]);
    expect(parseTimeRanges('not json')).toEqual([]);
  });
});
